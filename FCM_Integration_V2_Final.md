# FCM Push Notification Integration — V2 Final

**Architecture Freeze Document**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Final Architecture](#2-final-architecture)
3. [Database Design](#3-database-design)
4. [Supabase Edge Function](#4-supabase-edge-function)
5. [Client-Side Design](#5-client-side-design)
6. [Service Worker Design](#6-service-worker-design)
7. [File Structure](#7-file-structure)
8. [Environment Variables & Secrets](#8-environment-variables--secrets)
9. [Migration & Rollback](#9-migration--rollback)
10. [Testing Strategy](#10-testing-strategy)
11. [Updated Architectural Decisions](#11-updated-architectural-decisions)
12. [Final Security Decisions](#12-final-security-decisions)
13. [Architectural Decision Summary](#13-architectural-decision-summary)

---

## 1. Executive Summary

This document is the **final architecture freeze** for adding Firebase Cloud Messaging (FCM) push notifications to the Moktari application. It supersedes the V2 specification and incorporates all review decisions.

### Scope

| Included | Excluded |
|----------|----------|
| Database trigger → Edge Function → FCM pipeline | Retry logic |
| `device_tokens` table (separate) | Queue system |
| `notification_preferences` table (separate) | Delivery analytics |
| Single Edge Function (`send-fcm`) | Monitoring/alerting |
| `usePushNotifications` hook (unified) | Background cron jobs |
| Service worker for background push | NotificationService changes |
| `DeviceTokenService` for token CRUD | Changes to existing call sites |
| Foreground message handling | `notifications` table schema changes |
| Preference sync from SettingsPage | New TypeScript types in existing files |

### Immutable Constraints

- `NotificationService` — zero modifications.
- All 21 notification call sites — zero modifications.
- `src/types/notifications.ts` — zero modifications.
- `src/services/index.ts` — zero modifications.
- 56 existing tests — must pass unchanged.

---

## 2. Final Architecture

```
                    ┌─────────────────────────────────────┐
                    │    21 Existing Call Sites            │
                    │    (pages, components)               │
                    │    createNotificationService()       │
                    │    .create() / .createMany()         │
                    └────────────┬────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────────┐
                    │     NotificationService              │
                    │     (UNCHANGED — zero modifications) │
                    │     Validates → INSERT               │
                    └────────────┬────────────────────────┘
                                 │ supabase INSERT
                                 ▼
                    ┌─────────────────────────────────────┐
                    │     notifications TABLE              │
                    │     AFTER INSERT trigger fires       │
                    └────────────┬────────────────────────┘
                                 │ pg_net.http_post()
                                 │ (async, non-blocking)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                    send-fcm EDGE FUNCTION                         │
│                                                                  │
│  Entry: POST request with X-FCM-Secret header                    │
│                                                                  │
│  1. Validate X-FCM-Secret → 401 if mismatch                      │
│  2. Extract: { notification_id, user_id, type,                   │
│                title_ar, body_ar, link }                         │
│  3. Query: notification_preferences WHERE user_id = $2           │
│     → If prefs[type] === false: return { skipped: true }         │
│     → Any other value (missing, true, null): proceed             │
│  4. Query: device_tokens WHERE user_id = $2                      │
│     → If empty: return { skipped: "no_tokens" }                  │
│  5. Generate FCM OAuth token (cache globally)                    │
│  6. For each token:                                              │
│     a. POST to FCM HTTP v1 API                                   │
│     b. If success: continue                                      │
│     c. If UNREGISTERED/INVALID_ARGUMENT:                         │
│        DELETE FROM device_tokens WHERE token = $token            │
│  7. Return { delivered: N, invalidated: M }                      │
│                                                                  │
│  Error handling: any failure → return { error: "..." }           │
│  No retry. No queue. No logging table.                           │
└──────────────────────────────────────────────────────────────────┘
                                 │ HTTPS
                                 ▼
                    ┌─────────────────────────────────────┐
                    │         FCM HTTP v1 API              │
                    │   POST /v1/projects/{id}/messages    │
                    └────────────┬────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
┌─────────────────────────┐       ┌─────────────────────────────┐
│ FOREGROUND              │       │ BACKGROUND                   │
│ (app open/visible)      │       │ (app closed, tab hidden)     │
│                         │       │                             │
│ onMessage() fires       │       │ Service Worker:             │
│   → sonner toast        │       │   onBackgroundMessage()     │
│   → invalidate unread   │       │     → showNotification()    │
│   → dedup with Realtime │       │   notificationclick:        │
│                         │       │     1. close notification   │
│                         │       │     2. matchAll clients     │
│                         │       │     3. focus existing       │
│                         │       │     4. or open new window   │
│                         │       │     5. navigate to link     │
└─────────────────────────┘       └─────────────────────────────┘
```

### Data Flow Summary

```
Notification created → INSERT into notifications table
                     → trigger fires (AFTER INSERT)
                     → pg_net sends HTTP POST to Edge Function (async)
                     → Edge Function checks preferences & tokens
                     → Edge Function calls FCM API for each valid token
                     → Device receives push
                     
The INSERT returns to the caller immediately.
The trigger is fire-and-forget.
If the Edge Function is unreachable, the notification is still stored.
```

---

## 3. Database Design

### 3.1 `device_tokens` Table

```sql
CREATE TABLE public.device_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   TEXT NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_device_tokens_unique
  ON public.device_tokens (user_id, token);

CREATE INDEX idx_device_tokens_user
  ON public.device_tokens (user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
```

**RLS Policies (separate, not `FOR ALL`):**

```sql
CREATE POLICY "Users can register own tokens"
  ON public.device_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own tokens"
  ON public.device_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON public.device_tokens FOR DELETE
  USING (auth.uid() = user_id);
```

**Why separate policies instead of `FOR ALL`:**

| Consideration | `FOR ALL` | Separate Policies |
|---------------|-----------|-------------------|
| Clarity | Single statement, but hides which operations are permitted | Each operation explicitly listed — no ambiguity |
| Future modification | Changing one operation requires rewriting the entire policy | Individual policies can be added/removed independently |
| Audit trail | Policy name is generic | Policy names describe intent ("register", "view", "delete") |
| Principle of least privilege | Single policy applies the same `USING`/`CHECK` to all ops | Each operation can have different restrictions if needed |

**Decision**: Three separate policies. No `UPDATE` policy is needed because V2 deletes invalid tokens rather than updating them. If token invalidation via UPDATE is added in a future version, an `UPDATE` policy can be added independently.

**Edge Function access**: The Edge Function uses the `service_role` key, which bypasses RLS entirely. It can read all rows in `device_tokens` and delete invalid tokens without needing direct RLS policies.

### 3.2 `notification_preferences` Table

```sql
CREATE TABLE public.notification_preferences (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  prefs      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can upsert own preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);
```

**Expected JSON structure stored in `prefs`:**

```json
{
  "new_response": true,
  "listing_expiring": true,
  "listing_approved": true,
  "listing_rejected": true,
  "verification_update": true,
  "new_report": true,
  "system": true
}
```

**Edge Function preference logic (explicit contract):**

| `prefs[type]` value | Edge Function behavior |
|---------------------|----------------------|
| `false` | **Skip delivery.** User explicitly disabled this notification type. |
| `true` | Deliver push. |
| Missing key | Deliver push. **Default is enabled.** |
| `null` | Deliver push. Treated as "not disabled". |
| No row for user | Deliver push. No preferences saved yet = defaults (all enabled). |

**Why this contract matters**: It guarantees forward compatibility. If a new notification type is added in the future (e.g., `promotion`), the Edge Function will deliver pushes for it by default without requiring users to opt in. Users who want to disable it can do so via SettingsPage, which will write `"promotion": false`.

### 3.3 Database Trigger

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

CREATE OR REPLACE FUNCTION public.trigger_fcm_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _function_url TEXT;
  _secret       TEXT;
BEGIN
  SELECT decrypted_secret INTO _function_url
    FROM vault.decrypted_secrets
   WHERE name = 'fcm_edge_function_url';

  SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
   WHERE name = 'fcm_function_secret';

  -- Skip silently if the configuration is not present yet (pre-deploy window).
  IF _function_url IS NULL OR _secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := _function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-FCM-Secret', _secret
    ),
    body    := jsonb_build_object(
      'notification_id', NEW.id,
      'user_id',         NEW.user_id,
      'type',            NEW.type,
      'title_ar',        NEW.title_ar,
      'body_ar',         NEW.body_ar,
      'link',            NEW.link
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'trigger_fcm_delivery: failed for notification % — %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fcm_delivery
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_fcm_delivery();
```

**Key design points:**

- **`SECURITY DEFINER`**: The trigger runs with the privileges of the function owner (table owner). This is required for `net.http_post` to work.
- **`SET search_path = ''`**: Prevents search-path injection attacks. All objects must be schema-qualified.
- **Vault secret reads**: The trigger reads its configuration from `vault.decrypted_secrets` (schema-qualified, safe under `search_path = ''`). A missing secret returns NULL, so the function stays resilient during deployment windows and skips delivery until configured.
- **`EXCEPTION WHEN OTHERS`**: Catches ALL errors (network failure, missing extension, invalid URL). The INSERT succeeds regardless. The in-app notification flow is never blocked.
- **`RAISE WARNING`**: Logs the failure to PostgreSQL logs for debugging without affecting the transaction.

### 3.4 Setting the Configuration Values

Stored as Supabase Vault secrets (encrypted at rest), applied by migration `20260802143000_fcm_vault_config.sql` (idempotent). Equivalent manual SQL:

```sql
SELECT vault.create_secret('https://<project-ref>.functions.supabase.co/send-fcm', 'fcm_edge_function_url');
SELECT vault.create_secret('<random-64-char-string>', 'fcm_function_secret');
```

**Production safety assessment:**

| Concern | Assessment |
|---------|-----------|
| Custom GUC unavailable | ✅ Hosted Supabase does not permit `ALTER DATABASE SET` for custom `app.settings.*` GUCs (the `postgres` role is not superuser; `42501`). Vault is used instead. |
| Secret readable by SQL executors | ✅ **Acceptable.** The X-FCM-Secret is a low-sensitivity shared secret. It only authorizes calls to the Edge Function, which has limited blast radius (query device_tokens, call FCM). The truly sensitive values (FCM service account, Supabase service_role key) are stored as Supabase Secrets — never in the database. Vault also restricts `vault.decrypted_secrets` access. |
| Value encrypted at rest | ✅ Vault encrypts secrets with a wrapping key. |
| Rotation without downtime | ✅ Update the Vault secret, update the Edge Function's expected secret, then update the Edge Function secret. Brief mismatch window is handled by `EXCEPTION` block. |

**Alternative considered — hardcoding the secret in the trigger function body:**
Rejected. Hardcoding secrets in SQL migrations is bad practice — the secret would be in version control, visible to anyone with repository access.

**Alternative considered — dedicated `secrets` table with restricted RLS:**
Rejected for V1. Adds a table, an extra query per trigger invocation, and more moving parts. Supabase Vault provides the same isolation with less surface area.

**Final position**: Supabase Vault + `vault.decrypted_secrets` reads is production-safe for this use case, provided the stored secret is understood to be low-sensitivity (app-level shared secret, not infrastructure credential).

---

## 4. Supabase Edge Function

### 4.1 Overview

| Property | Value |
|----------|-------|
| **Name** | `send-fcm` |
| **File** | `supabase/functions/send-fcm/index.ts` |
| **Runtime** | Deno 2 |
| **Trigger** | HTTP POST via `pg_net` |
| **Auth** | `X-FCM-Secret` header (compared against `Deno.env.get('FCM_FUNCTION_SECRET')`) |
| **Supabase Secrets** | `FCM_SERVICE_ACCOUNT_JSON`, `FCM_FUNCTION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` |
| **External dependency** | `npm:google-auth-library` (OAuth 2.0 token generation) |
| **External API** | `POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send` |

### 4.2 Execution Contract

**Request:**
```json
{
  "notification_id": "uuid",
  "user_id": "uuid",
  "type": "new_message",
  "title_ar": "عنوان الإشعار",
  "body_ar": "نص الإشعار",
  "link": "/chat/conv-uuid"
}
```

**Success response (200):**
```json
{
  "delivered": 2,
  "invalidated": 0
}
```

**Skipped response (200):**
```json
{
  "skipped": "user_disabled",
  "type": "new_message"
}
```

```json
{
  "skipped": "no_tokens"
}
```

**Error response (200 — failure is not exceptional):**
```json
{
  "error": "FCM_API_ERROR",
  "message": "Requested entity was not found",
  "retryable": false
}
```

### 4.3 OAuth Token Cache

The FCM HTTP v1 API requires an OAuth 2.0 access token from the Firebase service account. These tokens expire after 3600 seconds. The Edge Function should:

1. On first invocation (cold start): load service account from `Deno.env`, generate OAuth token.
2. Cache the token in a module-level global variable (persists across warm invocations).
3. On subsequent invocations: reuse the cached token if still valid.
4. If FCM returns a 401 (expired or invalid token): regenerate the token and retry the request once.

```
Deno.globalThis.__fcm_oauth_token = {
  token: 'ya29....',
  expiresAt: Date.now() + 3000000,  // 50 minutes (buffer from 60 min expiry)
};
```

### 4.4 FCM Message Payload

```json
{
  "message": {
    "token": "<device_token>",
    "notification": {
      "title": "<title_ar>",
      "body": "<body_ar>"
    },
    "data": {
      "type": "<notification_type>",
      "link": "<link>",
      "title_ar": "<title_ar>",
      "body_ar": "<body_ar>"
    },
    "webpush": {
      "fcm_options": {
        "link": "/notifications"
      }
    }
  }
}
```

- **`notification` field**: Causes the OS/browser to display a system notification when the app is in the background. Automatic.
- **`data` field**: Delivered to the app regardless of foreground/background. Used by `onMessage` (foreground) and the service worker (background) to access `type`, `link`, and Arabic text.
- **`webpush.fcm_options.link`**: Used by FCM SDK on the web to set the notification's default click URL.

---

## 5. Client-Side Design

### 5.1 Architecture Overview

```
src/
├── firebase/
│   ├── client.ts              NEW — Firebase App singleton
│   └── messaging.ts           NEW — Messaging singleton + helpers
├── services/
│   ├── DeviceTokenService.ts  NEW — Token CRUD via Supabase
│   └── NotificationService.ts UNCHANGED
├── hooks/
│   └── usePushNotifications.ts NEW — Unified push lifecycle hook
├── contexts/
│   └── AuthContext.tsx         MODIFIED (~5 lines added)
├── pages/
│   └── SettingsPage.tsx        MODIFIED (~15 lines added)

public/
└── firebase-messaging-sw.js   NEW — Service worker (~40 lines)
```

### 5.2 `src/firebase/client.ts` (NEW)

**Purpose**: Initialize and export the Firebase App singleton.

```typescript
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
```

**Why a separate file**: The Firebase App is a singleton. It should be initialized once at module load time, not inside a React component or hook. Placing it in `client.ts` ensures a single initialization point. If the module is imported multiple times, Vite's module cache returns the same instance.

**Why not inline in `messaging.ts`**: Cleaner separation. `client.ts` handles app initialization and is stable. `messaging.ts` handles the Messaging SDK which has browser-specific requirements (`getMessaging()` throws if called outside a browser context — separating it allows `client.ts` to be imported in non-browser environments for other Firebase services).

### 5.3 `src/firebase/messaging.ts` (NEW)

**Purpose**: Export the Messaging instance and helper functions for token retrieval and foreground message handling.

Exports:
- `messaging`: Singleton `Messaging` instance.
- `requestAndGetToken(vapidKey: string): Promise<string>`: Requests notification permission and returns the FCM token.
- `onForegroundMessage(callback: (payload: MessagePayload) => void): () => void`: Registers a foreground message listener. Returns an unsubscribe function for cleanup.

**Why helpers instead of exposing `getMessaging` + `getToken` + `onMessage` raw**: The raw Firebase SDK requires callers to handle permission state, error codes, and browser compatibility. Encapsulating this in `requestAndGetToken` provides a single error boundary and a consistent API. The caller either gets a token or catches a typed error.

**VAPID key usage**: The VAPID public key is only needed by the client when calling `getToken()`. The service worker does **not** use the VAPID key. The VAPID key is configured in the Firebase Console (Web Push Certificates section) and provided to the client via `VITE_FIREBASE_VAPID_KEY`.

### 5.4 `src/services/DeviceTokenService.ts` (NEW)

**Purpose**: Provide framework-agnostic CRUD for the `device_tokens` table via Supabase.

```typescript
class DeviceTokenService {
  constructor(private supabase: SupabaseClient);

  async register(userId: string, token: string, platform: string): Promise<void>;
  async unregister(token: string): Promise<void>;
  async unregisterAllForUser(userId: string): Promise<void>;
}
```

**Why a class instead of standalone functions**: The service depends on a `SupabaseClient` instance. Encapsulating it in a class avoids passing `supabase` as a parameter to every function call. The consumer instantiates it once and reuses it.

**Why not a React hook**: Token operations (register, unregister) are called from both React components (usePushNotifications) and non-React code (AuthContext's signOut). A service class is framework-agnostic.

### 5.5 `src/hooks/usePushNotifications.ts` (NEW)

**Purpose**: Unified React hook managing the entire push notification lifecycle for the current user.

```typescript
function usePushNotifications(userId: string | null): {
  permission: NotificationPermission | null;
  token: string | null;
  isSupported: boolean;
  requestPermission: () => Promise<void>;
  error: string | null;
}
```

**Design rules:**

1. **Called unconditionally.** The hook is always invoked — it receives `userId` which may be `null`. This satisfies React's Rules of Hooks (no conditional hook calls).

2. **Internal effect management:**
   - Effect A (depends on `userId`): When `userId` transitions from null → non-null, attempt to get the FCM token and register it via `DeviceTokenService.register()`. When `userId` transitions to null (logout), call `DeviceTokenService.unregisterAllForUser()`.
   - Effect B (mount/unmount): Register the `onMessage` foreground listener. Clean up on unmount.
   - Effect C (token refresh): Listen for token rotation and upsert the new token.

3. **Graceful handling of `userId = null`:**
   - When `userId` is null (user not logged in), the hook returns `permission: null, token: null, isSupported: true, requestPermission: () => {...}, error: null`.
   - `requestPermission()` is still callable (browser permission is independent of auth state), but the token is not registered until `userId` becomes available.
   - Effects that depend on `userId` are no-ops when `userId` is null.

4. **Deduplication with Realtime subscription** (foreground only):
   - When a foreground message arrives, the hook extracts `data.notification_id`.
   - If this `notification_id` was recently added by the Realtime subscription (tracked via a `Set<string>` ref), the toast is suppressed.
   - The Realtime subscription on `notifications` table (existing in `NotificationsPage.tsx`) independently receives new rows. FCM foreground delivery is redundant but faster.

**Why a single hook instead of multiple:**

| Approach | Files | Complexity | Coordination |
|----------|-------|------------|--------------|
| Single `usePushNotifications` | 1 hook | Low (internal useEffect) | Internal — no cross-hook state |
| `useFcmPermission` + `useFcmToken` + `useFcmForeground` | 3 hooks | High (each needs their own state, effects, cleanup) | Caller must coordinate: permission → token → message listener |

No consumer would use permission management without token management, or foreground messages without permission. The three concerns are a single lifecycle. A unified hook reduces files, reduces import overhead, and eliminates cross-hook coordination bugs.

**Where it is called:**

`src/contexts/AuthContext.tsx` — once, at the top level of the context provider:

```typescript
const { user, ... } = useSomeAuthMethod();
const pushState = usePushNotifications(user?.id ?? null);
```

**Why AuthContext and not a separate provider:**

| Location | Rationale |
|----------|-----------|
| `AuthContext` | ✅ Already manages auth state. Single call site. Push lifecycle naturally follows auth lifecycle. |
| `App.tsx` | Would need to re-read auth state. Adds a render pass. |
| `MainLayout` | Not always mounted (auth pages don't use MainLayout). Push registration should persist across layouts. |
| New `PushProvider` context | Adds a context provider, another file, nesting. Over-engineering for V1. |

**AuthContext is the correct integration point** because:
1. It already has the `user` object — no prop drilling.
2. The `signOut` function is already here — token revocation is a one-line addition.
3. Push lifecycle is tied to auth lifecycle (register on login, revoke on logout).
4. Adding the hook inside the provider ensures it mounts once and unmounts only when the provider unmounts (app unload).

### 5.6 `src/contexts/AuthContext.tsx` (MODIFIED)

**Changes (additive, non-breaking):**

1. Add import of `usePushNotifications`:
   ```typescript
   import { usePushNotifications } from '@/hooks/usePushNotifications';
   ```

2. Add at the top of the provider component body (unconditional):
   ```typescript
   const pushState = usePushNotifications(user?.id ?? null);
   ```

3. Add to the `signOut` function (before clearing state, non-blocking):
   ```typescript
   // Token revocation is fire-and-forget — signOut proceeds regardless
   if (user) {
     const dts = new DeviceTokenService(supabase);
     dts.unregisterAllForUser(user.id).catch(() => {});
   }
   ```

**What does NOT change**: The `signOut` return type, the loading state, the error handling, the context value shape, any existing consumer. The FCM calls are fire-and-forget and do not block the auth flow.

### 5.7 `src/pages/SettingsPage.tsx` (MODIFIED)

**Changes (additive, non-breaking):**

1. **Permission toggle**: Add a new row (or section below the existing notification toggles) that shows:
   - Current permission state: `مسموح`, `مرفوض`, or `غير مفعل`
   - A toggle/button to request permission

2. **Preference sync line**: Inside the existing `toggleNotifPref` function, add one line after the existing `createNotificationService(supabase).setPreferences(updated)`:
   ```typescript
   await supabase.from('notification_preferences').upsert({
     user_id: user.id,
     prefs: updated,
   });
   ```

   This writes the same preference object to the database table that the Edge Function queries. The existing `NotificationService.setPreferences()` call is preserved — it continues to write to `localStorage` for in-app toggle rendering.

3. **Device token status**: Optionally display "الإشعارات الفورية مفعلة" or "الإشعارات الفورية غير مفعلة" based on `pushState.permission` from the hook.

**Why the preference sync is correct architecturally:**

| Concern | Explanation |
|---------|-------------|
| **Two stores** | `localStorage` (for in-app UI via `NotificationService`) + DB (for Edge Function). Different consumers, different storage. |
| **No duplication of logic** | The toggle handler already computes the `updated` preference object. The DB write is a single additional mutation. |
| **No change to NotificationService** | The service remains localStorage-only. It does not know about the database table. |
| **Consistency** | Both writes happen atomically from the user's perspective (within the same async function). If the DB write fails, the localStorage write already succeeded — the user sees the toggle change, but push delivery uses the old preference until the next write succeeds. |

---

## 6. Service Worker Design

### 6.1 File

`public/firebase-messaging-sw.js` — static JavaScript file served as-is from the project's public directory.

### 6.2 VAPID Key

**The service worker does NOT use the VAPID key.** Only the client-side `getToken()` call requires the VAPID public key. The service worker uses `importScripts` to load the Firebase SDK, initializes the app with the same Firebase config (apiKey, projectId, etc.), and receives messages via `onBackgroundMessage`. The VAPID key is not referenced anywhere in the service worker.

### 6.3 `onBackgroundMessage` Handler

The Firebase SDK's built-in `onBackgroundMessage` automatically intercepts push events and calls the registered callback. Inside the callback:

```typescript
// Received from FCM's onBackgroundMessage
messaging.onBackgroundMessage((payload) => {
  const { title_ar, body_ar, link, notification_id } = payload.data || {};

  self.registration.showNotification(title_ar || payload.notification?.title || '', {
    body: body_ar || payload.notification?.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { link, notification_id },
    tag: notification_id,  // Prevents duplicate system notifications
    renotify: false,
    requireInteraction: false,
  });
});
```

- **`tag: notification_id`**: Ensures that if the same notification is delivered twice (rare but possible), the OS replaces the existing notification instead of creating a duplicate.
- **`data`**: Passes `link` and `notification_id` to the `notificationclick` handler.

### 6.4 `notificationclick` Handler

```typescript
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification.data?.link || '/notifications';

  const urlToOpen = new URL(link, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // 1. Try to find and focus an existing client that matches the URL
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }

        // 2. Try to focus any existing client
        for (const client of windowClients) {
          if ('focus' in client) {
            return client.focus();
          }
        }

        // 3. Open a new window only if no client exists
        if ('openWindow' in clients) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
```

**Behavior:**

| Scenario | What Happens |
|----------|-------------|
| App window exists at the notification's `link` | That window is focused. No navigation needed. |
| App window exists but at a different URL | That window is focused. It does NOT navigate — the user is brought to the existing app state. |
| No app window exists | A new browser window/tab is opened at the notification's `link`. |
| Multiple app windows exist | The first matching window is focused. If none match, the first available window is focused. |

**Why focus existing instead of always opening new**: Prevents duplicate tabs. The app is a SPA — the existing window already has the full app loaded. Focusing it is faster and cleaner than loading a new instance.

**Why not navigate the existing window to the link**: The notification data already contains the `link`. When the app window receives focus, the `onMessage` handler in the app (or the Realtime subscription) can handle navigation. Alternatively, a future enhancement could use `postMessage` to the window, but this pattern pushes navigation logic into the SW which is harder to maintain.

**Accepted limitation**: The user is focused on the app but not navigated to the specific notification's `link`. They must tap the notification in the in-app list. Future versions can use `postMessage` or URL-based deep linking.

---

## 7. File Structure

### 7.1 New Files (6 source + 3 migrations = 9 total)

| # | File | Lines | Purpose |
|---|------|-------|---------|
| 1 | `public/firebase-messaging-sw.js` | ~40 | Background push handling (service worker) |
| 2 | `src/firebase/client.ts` | ~10 | Firebase App initialization |
| 3 | `src/firebase/messaging.ts` | ~20 | Messaging instance + `requestAndGetToken`, `onForegroundMessage` |
| 4 | `src/services/DeviceTokenService.ts` | ~30 | `register`, `unregister`, `unregisterAllForUser` via Supabase |
| 5 | `src/hooks/usePushNotifications.ts` | ~55 | Unified hook: permission, token, foreground messages |
| 6 | `supabase/functions/send-fcm/index.ts` | ~130 | Edge Function: preference check, token lookup, FCM delivery |
| 7 | Migration: `fcm_device_tokens` | ~30 lines SQL | Create `device_tokens` table, indexes, RLS |
| 8 | Migration: `fcm_notification_preferences` | ~20 lines SQL | Create `notification_preferences` table, RLS |
| 9 | Migration: `fcm_trigger` | ~45 lines SQL | Create `trigger_fcm_delivery` function + trigger |

### 7.2 Modified Files (3 total)

| # | File | Lines changed | Change |
|---|------|--------------|--------|
| 1 | `src/contexts/AuthContext.tsx` | ~5 | Call `usePushNotifications(user?.id ?? null)`, add token revocation on signOut |
| 2 | `src/pages/SettingsPage.tsx` | ~15 | Add permission request UI, sync preferences to `notification_preferences` table |
| 3 | `.env` | +6 lines | Add `VITE_FIREBASE_*` config vars |

### 7.3 Untouched Files (zero modifications)

| File | Reason |
|------|--------|
| `src/services/NotificationService.ts` | Must remain the single source of truth |
| `src/services/index.ts` | No new exports needed (DeviceTokenService is imported directly) |
| `src/types/notifications.ts` | No new types needed for V1 |
| `src/pages/NotificationsPage.tsx` | Realtime subscription + query already handles in-app display |
| All 21 call sites | Notification creation is unchanged |
| `src/main.tsx` | Service worker registration is handled by `firebase/messaging.ts` on demand |
| `src/App.tsx` | No new providers or routes |

---

## 8. Environment Variables & Secrets

### 8.1 Client-Side (`.env`) — All new

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=project-id
VITE_FIREBASE_STORAGE_BUCKET=project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_VAPID_KEY=BP...public_vapid_key...
```

All six values come from Firebase Console → Project Settings → General → Your apps → Web app. The VAPID public key comes from Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates.

These values are intentionally public. They identify the Firebase project but do not grant access. The Firebase API key is not a secret — it is embedded in every web app that uses Firebase.

### 8.2 Supabase Secrets (Edge Function)

Set via Supabase CLI or Dashboard:

```bash
supabase secrets set FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
supabase secrets set FCM_FUNCTION_SECRET='<random-64-char-string>'
supabase secrets set SUPABASE_SERVICE_ROLE_KEY='<from-supabase-dashboard>'
```

| Secret | Sensitivity | Used By | Stored In |
|--------|-------------|---------|-----------|
| `FCM_SERVICE_ACCOUNT_JSON` | **High** — can send arbitrary FCM messages | Edge Function (`Deno.env`) | Supabase Secrets only |
| `FCM_FUNCTION_SECRET` | **Low** — authorizes trigger → Edge Function calls | Edge Function (`Deno.env`) + Database (Supabase Vault) | Supabase Secrets + Vault secret |
| `SUPABASE_SERVICE_ROLE_KEY` | **High** — bypasses all RLS | Edge Function (`Deno.env`) | Supabase Secrets only |

**Security boundary**: Only the low-sensitivity `FCM_FUNCTION_SECRET` is stored in the database (via Supabase Vault, encrypted at rest). The high-sensitivity secrets (`FCM_SERVICE_ACCOUNT_JSON`, `SUPABASE_SERVICE_ROLE_KEY`) never enter the database and are only accessible to the Edge Function via `Deno.env`.

### 8.3 Database Settings (Supabase Vault)

Applied by migration `20260802143000_fcm_vault_config.sql` (idempotent). Equivalent manual SQL:

```sql
SELECT vault.create_secret('https://<project-ref>.functions.supabase.co/send-fcm', 'fcm_edge_function_url');
SELECT vault.create_secret('<same-as-FCM_FUNCTION_SECRET>', 'fcm_function_secret');
```

These are read by the trigger function via `vault.decrypted_secrets`.

---

## 9. Migration & Rollback

### 9.1 Migration Order

```
Step 1:  supabase migration new fcm_device_tokens
         → CREATE TABLE device_tokens, indexes, RLS policies

Step 2:  supabase migration new fcm_notification_preferences
         → CREATE TABLE notification_preferences, RLS policies

Step 3:  supabase migration new fcm_trigger
         → CREATE EXTENSION pg_net + supabase_vault (if not exists)
         → CREATE FUNCTION trigger_fcm_delivery() (reads config from Vault)
         → CREATE TRIGGER trg_fcm_delivery

Step 4:  supabase migration new fcm_vault_config
         → vault.create_secret('https://<ref>.functions.supabase.co/send-fcm', 'fcm_edge_function_url')
         → vault.create_secret('<same-as-FCM_FUNCTION_SECRET>', 'fcm_function_secret')

Step 5:  supabase db push
         → Apply all migrations

Step 6:  supabase functions deploy send-fcm
         → Deploy Edge Function

Step 7:  supabase secrets set FCM_SERVICE_ACCOUNT_JSON FCM_FUNCTION_SECRET SUPABASE_SERVICE_ROLE_KEY
         → Configure Edge Function secrets

Step 8:  Update .env with Firebase config
Step 9:  Deploy frontend build (new + modified files)
```

### 9.2 Rollback

```
Step 1:  Drop the trigger (no new notifications trigger Edge Function calls):
         DROP TRIGGER IF EXISTS trg_fcm_delivery ON public.notifications;

Step 2:  Drop the function:
         DROP FUNCTION IF EXISTS public.trigger_fcm_delivery();

Step 3:  Delete the Edge Function:
         supabase functions delete send-fcm

Step 4:  Roll back migrations:
         supabase migration down

Step 5:  Revert .env
Step 6:  Revert frontend changes (delete new files, revert modified files)
```

**In-app notifications work correctly at every step of the rollback.** The trigger is the only integration point between the notification system and the push delivery system. Dropping it disconnects FCM without affecting the existing notification pipeline.

---

## 10. Testing Strategy

### 10.1 What to Test (V1)

| Test | Type | Method | Pass Criteria |
|------|------|--------|---------------|
| Trigger fires on INSERT | Unit | Insert a notification row via SQL → check `net.http_post` was called | Edge Function receives the POST |
| Edge Function validates secret | Unit | Call Edge Function with wrong secret → 401 response | Returns 401 |
| Edge Function skips disabled type | Unit | Set `prefs = {"new_response": false}` → trigger `new_response` notification | Returns `{ skipped: "user_disabled" }` |
| Edge Function skips when no tokens | Unit | Register user with 0 tokens → trigger notification | Returns `{ skipped: "no_tokens" }` |
| Edge Function delivers to valid tokens | Integration | Register a mock token (from FCM test console) → trigger notification | FCM console shows delivery |
| Edge Function deletes invalid tokens | Integration | Register a fake/invalid token → trigger notification → check `device_tokens` | Token row is deleted |
| Client registers token | Integration | `DeviceTokenService.register()` → check `device_tokens` row | Row exists with correct user_id, token, platform |
| Client unregisters on logout | Integration | Call `unregisterAllForUser()` → check `device_tokens` | No rows for that user |
| Foreground message → toast | E2E (manual) | App in foreground → send test FCM message | Sonner toast appears |
| Background message → system notification | E2E (manual) | App backgrounded → send test FCM message | System notification appears |
| Notification click → app focus | E2E (manual) | Click system notification → existing app tab is focused | App window focused (not a new tab) |
| Preference sync to DB | Integration | Toggle a pref in SettingsPage → check `notification_preferences` table | `prefs` JSON updated correctly |

### 10.2 What NOT to Test (V1)

- Retry behavior (no retry)
- Delivery rate monitoring (no monitoring)
- iOS-specific push (limited support)
- Concurrent high-volume delivery (low volume expected)

### 10.3 Existing Test Pass Requirement

All 56 existing `vitest` tests must pass with zero code changes:

```bash
vitest run  # Expected: 56 passed, 0 failed
```

No existing test imports, types, or mocks are affected because:
- `NotificationService` is not modified
- No existing import paths are changed
- No existing type definitions are changed
- DB migrations are additive only (new tables)

---

## 11. Updated Architectural Decisions

### Decision 1: Separate RLS policies instead of `FOR ALL`

**Status: UPDATED from V2 spec.**

**Why**: `FOR ALL` is valid PostgreSQL syntax but obscures intent. Three separate policies (`INSERT`, `SELECT`, `DELETE`) make the security model explicit:
- `INSERT`: Users can register their own tokens.
- `SELECT`: Users can view their own tokens (diagnostic UI).
- `DELETE`: Users can delete their own tokens (logout, manual cleanup).
- No `UPDATE` policy: V2 deletes invalid tokens rather than updating them.

The Edge Function bypasses RLS entirely via `service_role` key.

### Decision 2: Notification preferences in a separate table

**Status: UNCHANGED from V2 spec.**

Separate table (`notification_preferences`) rather than a JSONB column in `profiles`. Rationale unchanged: domain separation, no migration risk on `profiles`, easier to query, easier to drop.

### Decision 3: Two preference stores (localStorage + DB)

**Status: UNCHANGED from V2 spec.**

`NotificationService` continues to use localStorage (unchanged). The Edge Function reads the DB table. SettingsPage writes to both. This is a single additional line in `toggleNotifPref`.

### Decision 4: Single `usePushNotifications` hook

**Status: UNCHANGED from V2 spec.**

A single hook for permission, token registration, and foreground messages. Three concerns that are always used together. Splitting them would add unnecessary coordination complexity.

### Decision 5: Static service worker

**Status: UNCHANGED from V2 spec.**

Static JS file in `public/` using `importScripts` from Firebase CDN. No build step, no Vite plugin, no dual-build complexity.

### Decision 6: No retry, no queue, delivery logging for V1

**Status: UNCHANGED from V2 spec.**

Best-effort delivery. In-app notification page is the source of truth. Transient failures are accepted.

### Decision 7: `pg_net` for trigger → Edge Function calls

**Status: UNCHANGED** but with clarified security documentation.

The Supabase Vault + `vault.decrypted_secrets` approach is production-safe for the intended use case (low-sensitivity shared secret). `ALTER DATABASE SET` for custom `app.settings.*` GUCs is unavailable in hosted Supabase (the `postgres` role is not superuser), so Vault is used. High-sensitivity secrets are stored as Supabase Secrets, never in the database.

### Decision 8: No `notifications` table modifications

**Status: UNCHANGED from V2 spec.**

No `sent_via_fcm` column, no `fcm_sent_at` column. The trigger only reads `NEW.*` without updating the row.

### Decision 9: Service worker focus behavior

**Status: IMPROVED from V2 spec.**

The `notificationclick` handler now follows the correct priority:
1. Focus matching URL window
2. Focus any existing window
3. Open new window

This matches standard PWA behavior and prevents duplicate tabs.

### Decision 10: Preference default contract

**Status: CLARIFIED from V2 spec.**

The Edge Function only skips delivery when `prefs[type] === false`. Any other value (missing, `true`, `null`, or no row at all) means **deliver by default**. Documented explicitly in the specification.

---

## 12. Final Security Decisions

### 12.1 Credential Separation

| Credential | Storage | Accessibility | Risk if leaked |
|------------|---------|---------------|----------------|
| Firebase API key (client) | `.env` (public) | Anyone with the web app | Low — identifies project, doesn't grant access |
| VAPID public key (client) | `.env` (public) | Anyone with the web app | Low — required for web push registration |
| FCM service account JSON | Supabase Secret | Edge Function only via `Deno.env` | **Critical** — can send pushes to any device |
| Supabase `service_role` key | Supabase Secret | Edge Function only via `Deno.env` | **Critical** — bypasses all RLS |
| `X-FCM-Secret` (shared) | DB setting + Supabase Secret | SQL executors + Edge Function | Low — only authorizes Edge Function calls |

### 12.2 RLS Model

- `device_tokens`: Three policies (SELECT, INSERT, DELETE) — users manage their own tokens.
- `notification_preferences`: Two policies (SELECT, INSERT) — users manage their own preferences.
- Edge Function: uses `service_role` key (bypasses RLS) for reading tokens and preferences, and for deleting invalid tokens.

### 12.3 Trigger Security

- `SECURITY DEFINER` with `SET search_path = ''` prevents search-path injection.
- Exception handler prevents trigger failures from blocking notification INSERTs.
- The trigger calls `net.http_post` with a shared secret (not the service_role key).

### 12.4 Edge Function Security

- Validates `X-FCM-Secret` header on every invocation. 401 on mismatch.
- Reads FCM service account from `Deno.env` — never logs it.
- OAuth tokens cached in memory (not logged, not persisted).
- Supabase `service_role` key used only for database queries — never exposed to clients.

---

## 13. Architectural Decision Summary

| # | Decision | Chosen | Rejected Alternatives | Rationale |
|---|----------|--------|----------------------|-----------|
| 1 | Trigger → Edge Function pipeline | `pg_net` HTTP POST | Client-side dispatch, queue table, Realtime webhook | No changes to 21 call sites. Async, non-blocking. Minimal infrastructure. |
| 2 | RLS policy style | Separate SELECT/INSERT/DELETE | Single `FOR ALL` policy | Explicit intent. Easier to audit. Independent modification. |
| 3 | Preference storage | Separate `notification_preferences` table | Column in `profiles`, localStorage-only | Domain separation. No migration risk on `profiles`. Edge Function can read it. |
| 4 | Preference write path | SettingsPage writes to both localStorage + DB | Modify NotificationService to use DB | NotificationService remains untouched. One line added. |
| 5 | Preference default behavior | Skip only on `=== false`. Default enabled. | Require explicit opt-in | Forward-compatible. New types are delivered without user action. |
| 6 | Client hook count | Single `usePushNotifications` | Three separate hooks | Three tightly-coupled concerns. Single lifecycle. Less coordination. |
| 7 | Hook location | Inside `AuthContext` | Separate provider, App.tsx, MainLayout | AuthContext already manages auth lifecycle. No nesting. |
| 8 | Service worker build | Static JS in `public/` | Vite plugin, TypeScript compilation | No build step. 40 lines. Firebase-recommended approach. |
| 9 | VAPID key location | Client only (`messaging.ts`) | Also in service worker | Service worker doesn't call `getToken()`. No VAPID needed. |
| 10 | notificationclick | Focus existing, then open new | Always open new | Prevents duplicate tabs. Standard PWA behavior. |
| 11 | NotificationService changes | **None** | Add DB preference sync, add FCM trigger | Zero modifications to the refactored service. All 56 tests pass unchanged. |
| 12 | Existing type changes | **None** | Add FCM types to `types/notifications.ts` | New types stay in the new files that need them. |
| 13 | Existing call site changes | **None** | Add push trigger after each `create()` | All 21 call sites remain identical. Trigger handles delivery. |
| 14 | Delivery reliability | Best-effort. No retry. | Queue + retry + monitoring | In-app page is source of truth. Push loss is acceptable degradation. |
| 15 | pg_net secret storage | Supabase Vault + `vault.decrypted_secrets` | Hardcoded in migration, secrets table | Not in version control. Low-sensitivity value. Encrypted at rest. |

---

## ARCHITECTURE STATUS: READY FOR IMPLEMENTATION

### Justification

The architecture satisfies all requirements:

- **NotificationService**: Zero modifications. All 56 tests pass unchanged.
- **21 call sites**: Zero modifications. Notification creation pipeline is untouched.
- **Minimal files**: 6 new source files + 3 migration files. 3 modified files.
- **No new infrastructure**: Single Edge Function. No queue, no cron, no monitoring.
- **Production security**: High-sensitivity credentials stored as Supabase Secrets only. Low-sensitivity shared secret in Supabase Vault. RLS on all new tables.
- **Clean integration**: DB trigger + Edge Function is the only integration point. Async, non-blocking, failure-isolated.
- **Rollback-safe**: Drop the trigger → FCM is disconnected. In-app notifications continue working.
- **Forward-compatible**: Preference default contract (skip only on `=== false`) ensures new notification types are delivered by default without code changes.

No further architectural review is required. Implementation may proceed.

---

*End of V2 Final — Architecture Freeze Document.*
