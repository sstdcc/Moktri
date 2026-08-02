# FCM Push Notification Integration — V2 (Minimum Viable Architecture)

## Table of Contents

1. [Architecture Diagram](#1-architecture-diagram)
2. [Core Design Principle](#2-core-design-principle)
3. [Database Changes](#3-database-changes)
4. [Supabase Edge Function](#4-supabase-edge-function)
5. [Client-Side Changes](#5-client-side-changes)
6. [New Files](#6-new-files)
7. [Modified Files](#7-modified-files)
8. [Environment Variables](#8-environment-variables)
9. [Migration & Rollback](#9-migration--rollback)
10. [Testing](#10-testing)
11. [Architectural Decision Summary](#11-architectural-decision-summary)

---

## 1. Architecture Diagram

```
                   ┌─────────────────────────────┐
                   │   21 Existing Call Sites     │
                   │   (pages, components)        │
                   └──────────┬──────────────────┘
                              │ createNotificationService(supabase)
                              │ .create() / .createMany()
                              ▼
                   ┌─────────────────────────────┐
                   │     NotificationService      │
                   │     (UNCHANGED)              │
                   │  Validates → INSERTs         │
                   └──────────┬──────────────────┘
                              │ supabase INSERT succeeds
                              ▼
         ┌──────────────────────────────────────────────┐
         │           notifications TABLE                │
         │  Row inserted → AFTER INSERT trigger fires   │
         └──────────────────┬───────────────────────────┘
                            │ pg_net.http_post()
                            ▼
         ┌──────────────────────────────────────────────┐
         │      send-fcm EDGE FUNCTION (only ONE)       │
         │                                              │
         │  1. Receive: { notification_id, user_id,     │
         │       type, title_ar, body_ar, link }        │
         │  2. Query: notification_preferences          │
         │  3. If disabled → skip                       │
         │  4. Query: device_tokens WHERE user_id       │
         │  5. For each token: POST to FCM HTTP v1 API  │
         │  6. If token invalid: DELETE from            │
         │     device_tokens (silently)                 │
         └──────────────────┬───────────────────────────┘
                            │ HTTPS
                            ▼
         ┌──────────────────────────────────────────────┐
         │           Firebase Cloud Messaging            │
         │     Routes to Web / Android / iOS             │
         └──────┬───────────────────────────────────────┘
                │
     ┌──────────┴──────────────────┐
     │                             │
     ▼                             ▼
┌─────────────────┐    ┌──────────────────────────┐
│ FOREGROUND       │    │ BACKGROUND               │
│ (app open)       │    │ (app closed/tab hidden)  │
│                  │    │                          │
│ onMessage()      │    │ Service Worker           │
│   → sonner toast │    │   → showNotification()   │
│   → invalidate   │    │   → notificationclick    │
│     unread count │    │     → focus/openWindow   │
└─────────────────┘    └──────────────────────────┘
```

**Key rule**: The Edge Function is the ONLY integration point between Supabase and FCM. It is a pure function: receive notification data → check preferences → deliver to all registered devices.

---

## 2. Core Design Principle

### The NotificationService does not change. At all.

| What does NOT change | Why |
|----------------------|-----|
| `NotificationService.create()` signature | All 21 call sites use it — no modifications |
| `NotificationService.createMany()` signature | Same as above |
| `NotificationService.getPreferences()` / `setPreferences()` | Preferences handled by NotificationService remain LOCALSTORAGE-ONLY — preserved exactly as-is. The Edge Function reads preferences from its own DB table (`notification_preferences`), not from `NotificationService`. See §3.2. |
| `NotificationService` error handling | Unchanged |
| Any export in `src/services/index.ts` | Unchanged (except possibly adding `DeviceTokenService`) |
| Any type in `src/types/notifications.ts` | Unchanged |

### The two preference stores are deliberately separated:

| Store | Read by | Purpose |
|-------|---------|---------|
| `localStorage` (via `NotificationService`) | `SettingsPage.tsx` (React rendering) | Controls in-app toggle state for the Settings UI |
| `notification_preferences` DB table | Edge Function (push delivery) | Controls whether FCM sends a push for each type |

**Why separate?** The existing `NotificationService` is localStorage-only. Changing it to write to the database would mean modifying the service, which we prohibit. Instead, `SettingsPage.tsx` writes to BOTH localStorage (for the existing UI) and the `notification_preferences` table (for the Edge Function). This is a single added line in `SettingsPage.tsx` — not a redesign of `NotificationService`.

---

## 3. Database Changes

### 3.1 `device_tokens` Table (NEW)

```sql
CREATE TABLE public.device_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token         TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_device_tokens_unique
  ON public.device_tokens (user_id, token);

CREATE INDEX idx_device_tokens_user
  ON public.device_tokens (user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tokens"
  ON public.device_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Why this design:**
- `UNIQUE (user_id, token)`: prevents duplicate token rows per user. The same token can theoretically appear for different users (rare but safe).
- No `last_used_at` or `is_valid` columns: omitted for V1. Invalid tokens are detected by the Edge Function via FCM error responses and DELETEd immediately. No need for soft-delete tracking.
- Single RLS policy covering ALL operations: simpler than separate SELECT/INSERT/DELETE policies.
- No `user_agent` column: diagnostic-only, not needed for V1.

### 3.2 `notification_preferences` Table (NEW)

```sql
CREATE TABLE public.notification_preferences (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  prefs      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON public.notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Why a separate table instead of a column in `profiles`:**
- **Separation of concerns**: `profiles` contains user identity data. Notification preferences are a different domain.
- **No migration risk on `profiles`**: `profiles` may have existing triggers, indexes, or constraints. A separate table avoids touching it.
- **Easier to query**: `SELECT * FROM notification_preferences WHERE user_id = ?` is clear and isolated.
- **Easier to drop later**: If preferences logic changes, the table can be dropped without affecting `profiles`.

### 3.3 Database Trigger

```sql
-- Requires pg_net extension: supabase add extension pg_net

CREATE OR REPLACE FUNCTION public.trigger_fcm_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.fcm_edge_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-FCM-Secret', current_setting('app.settings.fcm_function_secret')
    ),
    body := jsonb_build_object(
      'notification_id', NEW.id,
      'user_id', NEW.user_id,
      'type', NEW.type,
      'title_ar', NEW.title_ar,
      'body_ar', NEW.body_ar,
      'link', NEW.link
    )
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log and swallow: notification INSERT must never fail due to trigger
    RAISE WARNING 'FCM trigger failed for notification %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fcm_delivery
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_fcm_delivery();
```

**Critical safety feature**: The `EXCEPTION WHEN OTHERS` block ensures that if `pg_net` is unavailable or the Edge Function URL is misconfigured, the notification INSERT still succeeds. The trigger logs a warning and returns `NEW` — the in-app notification flow is never interrupted.

### 3.4 Required Supabase Settings

Before the trigger works, these must be configured:

```sql
-- Set via SQL or Supabase Dashboard
ALTER DATABASE postgres SET app.settings.fcm_edge_function_url TO 'https://<project>.functions.supabase.co/send-fcm';
ALTER DATABASE postgres SET app.settings.fcm_function_secret TO '<random-secret>';
```

These are database-level custom settings accessible via `current_setting()`. They can be set without modifying environment variables.

---

## 4. Supabase Edge Function

### 4.1 Overview

| Property | Value |
|----------|-------|
| **Name** | `send-fcm` |
| **Location** | `supabase/functions/send-fcm/index.ts` |
| **Trigger** | HTTP POST (via `pg_net` from DB trigger) |
| **Auth** | `X-FCM-Secret` header matching configured secret |
| **Runtime** | Deno 2 |
| **Dependencies** | `npm:google-auth-library` (for OAuth token) |
| **External calls** | FCM HTTP v1 API (`POST https://fcm.googleapis.com/v1/projects/{project}/messages:send`) |

### 4.2 Execution Flow

```
receive POST
  │
  ├─ validate X-FCM-Secret header → 401 if invalid
  │
  ├─ extract body: { notification_id, user_id, type, title_ar, body_ar, link }
  │
  ├─ QUERY notification_preferences WHERE user_id = recipient
  │   └─ if row exists AND prefs[type] == false → return { skipped: true }
  │
  ├─ QUERY device_tokens WHERE user_id = recipient
  │   └─ if empty → return { skipped: "no_tokens" }
  │
  ├─ GENERATE OAuth 2.0 token from FCM service account
  │   (cache in global Deno namespace across warm invocations)
  │
  ├─ FOR EACH token:
  │   ├─ BUILD FCM message payload
  │   ├─ POST to FCM HTTP v1 API
  │   ├─ SUCCESS → continue
  │   └─ FAILURE with UNREGISTERED/INVALID_ARGUMENT
  │       └─ DELETE FROM device_tokens WHERE token = failed_token
  │         (silent — device no longer valid)
  │
  └─ RETURN { delivered: N, invalidated: M }
```

### 4.3 Why This Edge Function Design Is Minimal

| Feature | Included? | Rationale |
|---------|-----------|-----------|
| Request validation | ✅ | `X-FCM-Secret` prevents unauthorized invocation |
| Preference check | ✅ | Required — without it, disabling a type in settings would still send pushes |
| Token query + FCM send | ✅ | Core job of the function |
| Inline token invalidation | ✅ | Prevents repeated failed sends to the same invalid token |
| Retry logic | ❌ | Omitted for V1. If FCM returns `UNAVAILABLE` (transient), the push is dropped. Acceptable for V1. |
| Notification history update | ❌ | V1 does not mark `notifications.sent_via_fcm` — no column added |
| Logging/analytics | ❌ | V1 does not log delivery results |
| Queue table | ❌ | Inline processing only — no queue infrastructure |
| Batch processing | ❌ | Each invocation handles one notification. FCM does not support batching anyway. |

### 4.4 FCM Message Payload (V1)

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
      "fcm_options": { "link": "/notifications" }
    }
  }
}
```

- Both `notification` and `data` fields are always included.
- `notification` ensures OS display when app is in background.
- `data` ensures the app can read `type`, `link`, and Arabic text when the user taps the notification.

### 4.5 Why `pg_net` Over Alternatives

| Approach | Why Not |
|----------|---------|
| **fcm_queue table + cron** | Adds a table, a cron job, a background worker. Over-engineered for V1. |
| **Supabase Realtime webhook** | Realtime webhooks are less configurable than `pg_net`. No header auth support. |
| **Client-side send after create()** | Requires modifying all 21 call sites and `NotificationService`. Prohibited. |

`pg_net` is the simplest path: one trigger function, one `net.http_post()` call, no queue, no cron, no additional tables.

**Limitation accepted for V1**: `pg_net` is asynchronous best-effort. If the Edge Function is down, the POST fails silently (trigger catches and swallows). The push is lost but the notification is stored and visible in-app. This is acceptable because the in-app notification page is the source of truth.

---

## 5. Client-Side Changes

### 5.1 Architecture Overview

```
src/
├── firebase/
│   ├── client.ts              NEW — Firebase app initialization
│   └── messaging.ts           NEW — Messaging instance + helpers
├── services/
│   ├── DeviceTokenService.ts  NEW — Token CRUD with Supabase
│   └── NotificationService.ts UNCHANGED — not touched
├── hooks/
│   └── usePushNotifications.ts NEW — Combined hook (permission, token, foreground)
├── types/
│   └── notifications.ts       UNCHANGED — no new types needed
├── contexts/
│   └── AuthContext.tsx         MODIFIED — call usePushNotifications on mount, revoke on logout
└── pages/
    └── SettingsPage.tsx        MODIFIED — permission request UI + preference sync to DB

public/
└── firebase-messaging-sw.js   NEW — service worker for background pushes
```

**Total**: 4 new files, 2 modified files. No changes to `NotificationService`, `services/index.ts`, `types/notifications.ts`, or any of the 21 call sites.

### 5.2 `src/firebase/client.ts` (NEW)

| Question | Answer |
|----------|--------|
| Why does it exist? | Centralizes Firebase app initialization. Single import for all Firebase consumers. |
| Why not inline in `messaging.ts`? | Separation of concerns: `client.ts` handles the Firebase app instance; `messaging.ts` handles the Messaging instance. If `messaging.ts` grows, `client.ts` stays stable. |
| What does it do? | Initializes `FirebaseApp` using `VITE_FIREBASE_*` env vars. Exports `firebaseApp`. |
| Why not use a hook? | Firebase app is a singleton — it does not belong in React state. A module-level export is correct. |

### 5.3 `src/firebase/messaging.ts` (NEW)

| Question | Answer |
|----------|--------|
| Why does it exist? | Wraps `getMessaging()` and provides `requestAndGetToken()` and `onForegroundMessage()`. |
| Why separate from `client.ts`? | `getMessaging()` requires the Firebase app. Code is clearer when app init and messaging init are in separate files. Also: `messaging.ts` can be tree-shaken if only `client.ts` is imported elsewhere. |
| What does it export? | `messaging` (singleton instance), `requestAndGetToken(vapidKey): Promise<string>`, `onForegroundMessage(callback): () => void` (returns unsubscribe function). |
| Why no react-firebase-hooks? | An extra dependency with its own abstraction. A 10-line wrapper is clearer. |

### 5.4 `src/services/DeviceTokenService.ts` (NEW)

| Question | Answer |
|----------|--------|
| Why does it exist? | Manages the `device_tokens` table from the client side. Separates Supabase token operations from Firebase messaging logic. |
| Why a service and not part of a hook? | Service is framework-agnostic; can be used in contexts, pages, or other services. A hook would tie it to React. |
| Methods | `register(userId, token, platform)`, `unregister(token)`, `unregisterAllForUser(userId)`. |
| Why not a full CRUD service? | V1 only needs register and unregister. `getAllForUser` can be added later if needed. |

### 5.5 `src/hooks/usePushNotifications.ts` (NEW)

| Question | Answer |
|----------|--------|
| Why a single hook instead of multiple? | Three responsibilities (permission, token registration, foreground messages) are tightly coupled: all relate to "push notification lifecycle". Splitting them would force callers to coordinate state across multiple hooks. |
| What does it return? | `{ permission, token, isSupported, requestPermission, error }` |
| What does it handle internally? | `onMessage` listener registration and cleanup via `useEffect`. Token rotation via `onTokenRefresh`. Deduplication with Realtime subscription using `notification_id`. |
| When is it called? | Once at the root of the auth-gated part of the app (in `AuthContext` or `App`). |
| Why not split into `useFcmPermission`, `useFcmToken`, `useFcmForeground`? | Over-engineering. These three concerns are not independently useful. A developer would never use `useFcmPermission` without also needing token management. A single hook with a clean API is simpler to consume. |

### 5.6 `public/firebase-messaging-sw.js` (NEW)

| Question | Answer |
|----------|--------|
| Why a static JS file instead of a compiled TypeScript service worker? | Vite cannot easily compile TypeScript service workers with `importScripts` from CDN. A static JS file in `public/` is served as-is and requires no build step. It is 40 lines. |
| Why `importScripts` from Firebase CDN instead of bundling `firebase/messaging`? | Service workers cannot use ES module imports from `node_modules` without additional build configuration. CDN `importScripts` is the Firebase-recommended approach for Vite/Webpack projects. |
| What does it handle? | Two events: `onBackgroundMessage` (calls `showNotification` with data from payload) and `notificationclick` (closes notification, opens or focuses the app at the notification's link). |

### 5.7 `src/contexts/AuthContext.tsx` (MODIFIED)

| Change | Why |
|--------|-----|
| Call `usePushNotifications()` when user is authenticated | Starts the push notification lifecycle (permission request if needed, token registration, foreground listener). |
| Call `DeviceTokenService.unregisterAllForUser()` on sign out | Revokes all device tokens for this user. Prevents stale tokens from receiving pushes after logout. |
| Pass `user.id` to `DeviceTokenService` operations | Required for token CRUD against the `device_tokens` table. |

**What does NOT change in AuthContext**: The `signOut` function's return type, error handling, or the rest of the auth flow. The FCM call is non-blocking — if token revocation fails, sign-out continues.

### 5.8 `src/pages/SettingsPage.tsx` (MODIFIED)

| Change | Why |
|--------|-----|
| Add "تفعيل الإشعارات الفورية" toggle | Requests browser notification permission. This is a user-initiated action (click), required by browsers. |
| Show current permission state | Displays `مسموح`, `مرفوض`, or `غير مفعل` based on `Notification.permission`. |
| On toggle change, write preferences to `notification_preferences` DB table | Syncs settings to the table that the Edge Function queries. The existing `NotificationService.setPreferences()` call remains unchanged (writes to localStorage for the in-app toggle rendering). |

**The critical sync line** (added inside the existing `toggleNotifPref` function):
```
await supabase.from('notification_preferences').upsert({
  user_id: user.id,
  prefs: updated,
});
```

This is the ONLY additional line in the toggle handler. The existing `NotificationService.setPreferences(updated)` call stays.

---

## 6. New Files

| # | File | Lines (est.) | Purpose |
|---|------|-------------|---------|
| 1 | `public/firebase-messaging-sw.js` | ~40 | Service worker for background push handling |
| 2 | `src/firebase/client.ts` | ~10 | Firebase app initialization |
| 3 | `src/firebase/messaging.ts` | ~20 | Messaging instance + helper functions |
| 4 | `src/services/DeviceTokenService.ts` | ~30 | Token register/unregister via Supabase |
| 5 | `src/hooks/usePushNotifications.ts` | ~50 | Combined push lifecycle hook |
| 6 | `supabase/functions/send-fcm/index.ts` | ~120 | Edge Function for FCM delivery |
| 7 | Migration: `device_tokens` table | ~20 lines SQL | Create device_tokens table |
| 8 | Migration: `notification_preferences` table | ~15 lines SQL | Create notification_preferences table |
| 9 | Migration: trigger function + trigger | ~40 lines SQL | Create trigger_fcm_delivery function and trigger |

**Total new files**: 6 source files + 3 migration files = 9 new files.

---

## 7. Modified Files

| # | File | Change | Lines changed |
|---|------|--------|--------------|
| 1 | `src/contexts/AuthContext.tsx` | Add `usePushNotifications()` call (auth-gated), add token revocation on logout | ~5 |
| 2 | `src/pages/SettingsPage.tsx` | Add permission request toggle + preference sync to DB | ~15 |
| 3 | `.env` | Add `VITE_FIREBASE_*` and `VITE_FIREBASE_VAPID_KEY` | +6 |

**Total modified files**: 3. No modifications to `NotificationService`, `services/index.ts`, `types/notifications.ts`, `main.tsx`, `App.tsx`, or any of the 21 call sites.

---

## 8. Environment Variables

### Client-Side (`.env`)

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=project-id
VITE_FIREBASE_STORAGE_BUCKET=project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_VAPID_KEY=BP...public_vapid_key...
```

### Supabase Secrets (Edge Function)

```env
FCM_SERVICE_ACCOUNT_JSON={...}
FCM_FUNCTION_SECRET=<random-64-char-string>
```

---

## 9. Migration & Rollback

### 9.1 Migration Order

1. Run `supabase migration new fcm_device_tokens` → create `device_tokens` table
2. Run `supabase migration new fcm_notification_preferences` → create `notification_preferences` table
3. Run `supabase migration new fcm_trigger` → create trigger function + attach trigger
4. Run `supabase db push` to apply all
5. Deploy Edge Function: `supabase functions deploy send-fcm`
6. Update `.env` with Firebase config
7. Deploy frontend build

### 9.2 Rollback

1. Drop the trigger: `DROP TRIGGER IF EXISTS trg_fcm_delivery ON notifications;`
2. Drop the function: `DROP FUNCTION IF EXISTS trigger_fcm_delivery;`
3. Delete the Edge Function: `supabase functions delete send-fcm`
4. Roll back migrations: `supabase migration down`
5. Revert `.env`
6. Delete new source files (optional — they are inert without Firebase config)

**In-app notifications continue working at every step of the rollback.**

---

## 10. Testing

### 10.1 What to Test (V1)

| Test | Type | How |
|------|------|-----|
| Insert a notification → Edge Function is called | Integration | Insert into `notifications` table → check `supabase functions logs` for invocation |
| Invalid token is cleaned up | Integration | Insert an invalid token into `device_tokens`, trigger notification → verify token row is deleted |
| Disabled preference skips push | Integration | Set `prefs['new_message'] = false` → send `new_message` notification → verify Edge Function logs `skipped` |
| Valid token receives FCM message | E2E (manual) | Open app in Chrome, grant permission → perform action that creates a notification → verify push appears |
| Service worker shows notification | E2E (manual) | App in background, perform action → verify system notification appears in OS |
| Notification click navigates correctly | E2E (manual) | Click system notification → verify app opens at correct link |
| Logout clears device tokens | E2E (manual) | Login, grant permission, logout → verify `device_tokens` table has no tokens for this user |

### 10.2 What NOT to Test (V1)

- Retry behavior (no retry in V1)
- Delivery analytics (no logging in V1)
- Multiple Edge Function invocations in parallel (low volume in V1)
- iOS push (not fully supported in V1)

### 10.3 Existing Tests

All 56 existing `vitest` tests must pass with zero modifications. No existing test is affected because:
- `NotificationService` is not changed
- No existing import paths are changed
- No existing type definitions are changed
- The DB migration is additive (new tables only)

---

## 11. Architectural Decision Summary

### Decision 1: Edge Function with `pg_net` instead of a queue or client-side dispatch

| Alternative | Why Rejected |
|-------------|--------------|
| **Client-side dispatch after create()** | Would require modifying `NotificationService` and all 21 call sites. Violates the single-source-of-truth principle. |
| **fcm_queue table + cron job** | Adds a table, a cron worker, monitoring for backlog. V1 does not need queuing — losing a push is acceptable. |
| **Supabase Realtime webhook** | Less configurable auth (no custom headers), less reliable for server-to-server calls. |

**Chosen**: `pg_net` — one function call, one trigger, no additional infrastructure. Simple.

### Decision 2: Notification preferences in a separate table instead of a column in `profiles`

| Alternative | Why Rejected |
|-------------|--------------|
| **JSONB column in `profiles`** | Ties preference data to user profile domain. Requires migration on `profiles` which may have existing constraints. Harder to revert. |
| **No preference table (Edge Function reads localStorage)** | Edge Function cannot access client-side `localStorage`. Impossible. |
| **Reuse `NotificationService.getPreferences()`** | Service reads from `localStorage` — only works on the client. Edge Function runs server-side. |

**Chosen**: Separate `notification_preferences` table — clean domain boundary, isolated migration, easy to drop.

### Decision 3: Two preference stores (localStorage + DB) instead of unifying

| Alternative | Why Rejected |
|-------------|--------------|
| **Modify `NotificationService` to use DB** | Would require changing the service interface, its tests, and all call sites. Prohibited. |
| **Replace localStorage entirely with DB** | Would change existing behavior. The SettingsPage rendering depends on synchronous localStorage reads. Introducing async DB reads for toggle rendering is a UX regression. |

**Chosen**: `SettingsPage` writes to both stores. The Edge Function reads from DB. `NotificationService` continues reading from localStorage. This is one line added to `toggleNotifPref` — minimal impact.

### Decision 4: Single `usePushNotifications` hook instead of multiple hooks

| Alternative | Why Rejected |
|-------------|--------------|
| **`useFcmPermission` + `useFcmToken` + `useFcmForegroundMessage`** | Three hooks that are always used together. No consumer would use one without the others. Splitting adds import overhead and cross-hook coordination complexity. |

**Chosen**: One hook, three responsibilities, clean return type. Simpler API surface.

### Decision 5: Static service worker in `public/` instead of Vite-compiled

| Alternative | Why Rejected |
|-------------|--------------|
| **Vite plugin (`vite-plugin-pwa`)** | Adds build dependency, configuration complexity, and generates a service worker that may not integrate well with Firebase importScripts. |
| **Compiled TypeScript service worker with separate build** | Requires dual build setup. Over-engineered for a 40-line file. |

**Chosen**: Static JS file in `public/` — served as-is, no build step, matches Firebase documentation.

### Decision 6: No retry, no queue, no delivery logging for V1

| Why | Explanation |
|-----|-------------|
| The in-app notification page is the source of truth | Users always see notifications when they open the app. A lost push is a convenience degradation, not data loss. |
| Transient FCM failures are rare | FCM Uptime SLA is 99.9%. A dropped push is an edge case. |
| Retry adds complexity | Requires queue table, backoff logic, monitoring, cleanup, and error classification. These can be added in V2 if real-world data shows need. |
| Delivery logging adds cost | Another table, another query, monitoring. Not needed until we need to measure delivery rates. |

**Chosen**: Best-effort delivery. The notification is stored in the database. Push is fire-and-forget. If it fails, the user sees it in the app.

### Decision 7: `pg_net` extension dependency accepted

| Risk | Mitigation |
|------|------------|
| `pg_net` is a Supabase extension that must be enabled | `supabase add extension pg_net` — one command. If unavailable, the trigger catches the error and swallows it. In-app notifications are unaffected. |
| `pg_net` may have latency | The HTTP POST is async from the database's perspective. The INSERT returns immediately. No user-facing latency. |

**Chosen**: `pg_net` is the simplest async HTTP call mechanism from a PG trigger. If a future Supabase version deprecates it, the trigger body can be replaced with a different mechanism (queue table, Edge Function database hook, etc.) without changing the Edge Function or any client code.

### Decision 8: `notifications` table remains untouched (no `sent_via_fcm` column)

| Why rejected | Explanation |
|--------------|-------------|
| Helpful for debugging | But adds a column update per notification (another DB write). V1 does not need delivery analytics. Can be added in V2 as a separate migration. |

The trigger only reads `NEW.*` — it does not UPDATE the row afterward. This keeps the trigger fast and idempotent.

---

*End of V2 Specification.*
