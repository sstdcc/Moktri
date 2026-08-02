# FCM Push Notification Integration — Technical Architecture Specification

## Table of Contents

1. [Current Notification Flow](#1-current-notification-flow)
2. [Where FCM Should Integrate](#2-where-fcm-should-integrate)
3. [Required Database Changes](#3-required-database-changes)
4. [Device Token Management](#4-device-token-management)
5. [Token Lifecycle](#5-token-lifecycle)
6. [Authentication / Security](#6-authentication--security)
7. [Firebase Server Architecture](#7-firebase-server-architecture)
8. [Supabase Integration](#8-supabase-integration)
9. [Edge Functions vs Alternatives](#9-edge-functions-vs-alternatives)
10. [Retry Strategy](#10-retry-strategy)
11. [Duplicate Prevention](#11-duplicate-prevention)
12. [Failure Handling](#12-failure-handling)
13. [Offline Behavior](#13-offline-behavior)
14. [Background Delivery](#14-background-delivery)
15. [Foreground Delivery](#15-foreground-delivery)
16. [Web Support](#16-web-support)
17. [Android Support](#17-android-support)
18. [iOS Support](#18-ios-support)
19. [Performance Considerations](#19-performance-considerations)
20. [Security Considerations](#20-security-considerations)
21. [Required Environment Variables](#21-required-environment-variables)
22. [File-by-File Modification List](#22-file-by-file-modification-list)
23. [New Files to Create](#23-new-files-to-create)
24. [Existing Files to Modify](#24-existing-files-to-modify)
25. [Migration Strategy](#25-migration-strategy)
26. [Rollback Strategy](#26-rollback-strategy)
27. [Testing Strategy](#27-testing-strategy)
28. [Risks](#28-risks)
29. [Recommended Implementation Phases](#29-recommended-implementation-phases)

---

## 1. Current Notification Flow

```
                    ┌──────────────────────────────────────┐
                    │        21 Frontend Call Sites         │
                    │  (components, pages, admin panels)    │
                    └──────────┬───────────────────────────┘
                               │ createNotificationService(supabase)
                               │ .create(type, recipientId, payload)
                               │ .createMany(inputs[])
                               ▼
                    ┌──────────────────────────────────────┐
                    │         NotificationService           │
                    │   (src/services/NotificationService.ts)│
                    │   - Validates input                   │
                    │   - Inserts into Supabase             │
                    │   - Maps DB response to typed result  │
                    └──────────┬───────────────────────────┘
                               │ supabase.from('notifications').insert(...)
                               ▼
                    ┌──────────────────────────────────────┐
                    │      Supabase `notifications` table    │
                    │   - RLS policies control insert        │
                    │   - DB triggers auto-insert for admins │
                    │   - Realtime publication enabled       │
                    └──────────┬───────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    ┌─────────────────┐ ┌───────────┐ ┌───────────────┐
    │ NotificationsPage│ │useUnread- │ │ Per-page       │
    │ Realtime INSERT  │ │ Count     │ │ supabase.query │
    │ subscription     │ │ query     │ │ (initial load) │
    └─────────────────┘ └───────────┘ └───────────────┘
              ▼
    ┌──────────────────────────────────────┐
    │      In-app rendering only            │
    │  - No system/OS notifications         │
    │  - No delivery when app is closed     │
    │  - No delivery in background tab      │
    └──────────────────────────────────────┘
```

**Key limitation**: If the user is not actively viewing the app, or the browser tab is backgrounded, or the app is closed — the notification is never seen until the user opens the app and the query/subscription fires.

---

## 2. Where FCM Should Integrate

FCM must be inserted **after** the notification is persisted in the database, as a separate asynchronous delivery step. The existing notification creation pipeline remains untouched.

```
                    ┌──────────────────────────────────────┐
                    │         NotificationService           │
                    │   .create() / .createMany()           │
                    └──────────┬───────────────────────────┘
                               │ INSERT succeeds
                               ▼
                    ┌──────────────────────────────────────┐
                    │   Supabase `notifications` table      │
                    │   Row inserted successfully            │
                    └──────────┬───────────────────────────┘
                               │
              ┌────────────────┼──────────────────────────────┐
              ▼                ▼                              ▼
    ┌─────────────────┐ ┌───────────┐              ┌──────────────────┐
    │ Existing in-app  │ │ Realtime  │              │  NEW: FCM Push   │
    │ rendering flow   │ │ subscript.│              │  Delivery Layer  │
    │ (unchanged)      │ │ (unchanged)│             │                  │
    └─────────────────┘ └───────────┘              │  Triggered by:   │
                                                   │  DB trigger OR   │
                                                   │  Edge Function   │
                                                   │  (in-app hook)   │
                                                   └────────┬─────────┘
                                                            │
                                              ┌──────────────┼──────────────┐
                                              ▼              ▼              ▼
                                    ┌──────────────┐ ┌──────────┐ ┌──────────────┐
                                    │ Web Push FCM │ │ Android  │ │ iOS APNs via │
                                    │ (Service     │ │ (FCM SDK)│ │ FCM          │
                                    │  Worker)     │ │          │ │              │
                                    └──────────────┘ └──────────┘ └──────────────┘
```

**Integration point**: Two viable approaches:

### Approach A: Supabase Database Trigger → Edge Function (Recommended)
```
INSERT on notifications → PG trigger → notify a Supabase Edge Function
                                      → Edge Function queries device_tokens
                                      → Edge Function calls FCM HTTP v1 API
                                      → FCM delivers to device(s)
```

- **Pros**: Decoupled, works even if the inserting client is offline after the insert, single point of delivery logic, no client-side changes to the 21 call sites.
- **Cons**: Requires Edge Function infrastructure, slight latency.

### Approach B: In-app hook after `create()` / `createMany()`
```
NotificationService.create() → returns result
                              → caller optionally triggers push
```

- **Pros**: Simpler initial implementation.
- **Cons**: Must modify all 21 call sites, breaks if the client disconnects after DB insert, inconsistent coverage.

**Recommendation**: Approach A (DB trigger → Edge Function). All 21 call sites remain completely unchanged.

---

## 3. Required Database Changes

### 3.1 New Table: `device_tokens`

```sql
CREATE TABLE public.device_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token         TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
  user_agent    TEXT,                              -- for web tokens, diagnostic only
  last_used_at  TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),

  -- Enforce one token per user per platform to prevent bloat
  UNIQUE (user_id, platform, token)
);

CREATE INDEX idx_device_tokens_user_id ON public.device_tokens (user_id);
CREATE INDEX idx_device_tokens_token    ON public.device_tokens (token);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read their own tokens (for UI display of registered devices)
CREATE POLICY "Users can read own device tokens"
  ON public.device_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own tokens (token registration)
CREATE POLICY "Users can insert own device tokens"
  ON public.device_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own tokens (logout/unregister)
CREATE POLICY "Users can delete own device tokens"
  ON public.device_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Edge Function uses service_role key (bypasses RLS) to read tokens for delivery
```

### 3.2 New Column: `notifications.sent_via_fcm`

Optional audit column to track which notifications were successfully dispatched via FCM.

```sql
ALTER TABLE public.notifications
  ADD COLUMN sent_via_fcm BOOLEAN DEFAULT FALSE;
```

This enables:
- Monitoring delivery success rates
- Retry for failed pushes
- Debugging delivery issues

### 3.3 New Column: `notifications.fcm_sent_at`

```sql
ALTER TABLE public.notifications
  ADD COLUMN fcm_sent_at TIMESTAMPTZ;
```

### 3.4 Realtime Publication

No change needed. `notifications` is already added to the `supabase_realtime` publication.

### 3.5 Database Trigger Function

```sql
-- Trigger function fires after INSERT on notifications
-- It calls a Supabase Edge Function via pg_net extension
-- or writes to a queue table that the Edge Function polls.

CREATE OR REPLACE FUNCTION public.notify_fcm_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Option 1: Via pg_net (async HTTP call to Edge Function)
  -- Requires: supabase add extension pg_net
  --
  -- PERFORM net.http_post(
  --   url := current_setting('app.settings.fcm_edge_function_url'),
  --   headers := jsonb_build_object(
  --     'Content-Type', 'application/json',
  --     'Authorization', 'Bearer ' || current_setting('app.settings.fcm_service_key')
  --   ),
  --   body := jsonb_build_object(
  --     'notification_id', NEW.id,
  --     'user_id', NEW.user_id,
  --     'type', NEW.type,
  --     'title_ar', NEW.title_ar,
  --     'body_ar', NEW.body_ar,
  --     'link', NEW.link
  --   )
  -- );
  --
  -- Option 2: Insert into a queue table that Edge Function polls
  -- INSERT INTO fcm_queue (notification_id, user_id, type, title_ar, body_ar, link)
  -- VALUES (NEW.id, NEW.user_id, NEW.type, NEW.title_ar, NEW.body_ar, NEW.link);

  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_notify_fcm_delivery
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_fcm_delivery();
```

### 3.6 Queue Table (if using polling approach instead of pg_net)

```sql
CREATE TABLE public.fcm_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  title_ar        TEXT,
  body_ar         TEXT,
  link            TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  retry_count     INT DEFAULT 0,
  max_retries     INT DEFAULT 3,
  last_error      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX idx_fcm_queue_status ON public.fcm_queue (status, created_at);
```

### 3.7 Summary of All Database Changes

| Change | Type | Purpose |
|--------|------|---------|
| `device_tokens` table | New | Store FCM device tokens per user |
| `notifications.sent_via_fcm` | New column | Audit delivery status |
| `notifications.fcm_sent_at` | New column | Timestamp of FCM delivery |
| `fcm_queue` table | New (optional) | Queue for Edge Function processing |
| `notify_fcm_delivery()` function | New | Trigger function to enqueue push |
| Trigger on `notifications` | New | Fires after INSERT |

---

## 4. Device Token Management

### 4.1 Token Registration Flow

```
User logs in / opens app
       │
       ▼
┌─────────────────────────────┐
│ 1. Request notification     │
│    permission (browser)     │
└──────────┬──────────────────┘
           │ granted
           ▼
┌─────────────────────────────┐
│ 2. Get FCM token via        │
│    getToken(messaging, {    │
│      vapidKey: '...'        │
│    })                       │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 3. Upsert token to          │
│    device_tokens table via  │
│    supabase RPC or direct   │
│    insert                   │
│    (handled by token        │
│     manager service)        │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 4. Edge Function now has    │
│    token to deliver to      │
└─────────────────────────────┘
```

### 4.2 Token Refresh

FCM tokens can change (e.g., app reinstall, service worker update, token rotation). The `onTokenRefresh` handler must update the `device_tokens` table.

```typescript
// Pseudocode for token refresh handler
onMessage(messaging, (payload) => {
  // 1. Check if notification preferences allow this type
  // 2. Show in-app toast (foreground) or update badge
});

// Token refresh
onTokenRefresh(messaging, async () => {
  const newToken = await getToken(messaging, { vapidKey: VAPID_KEY });
  // Upsert newToken, delete old token
});
```

### 4.3 Token Revocation

On logout, all device tokens for this user on the current platform must be deleted.

```typescript
// In AuthContext signOut:
await createDeviceTokenService(supabase).removeAllForPlatform(user.id, platform);
```

### 4.4 Token Cleanup (Garbage Collection)

Tokens that repeatedly fail delivery (e.g., unregistered device, expired token) should be:
1. Marked as `invalid` in the `device_tokens` table (add `is_valid BOOLEAN DEFAULT TRUE` column), OR
2. Soft-deleted (add `deleted_at TIMESTAMPTZ` column and exclude from query).

The Edge Function should report back invalid tokens after each delivery attempt so the cleanup process can mark them.

---

## 5. Token Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                     TOKEN LIFECYCLE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  REGISTERED ─────────────────────────────────────────────────┐   │
│    │  User opens app, grants permission,                     │   │
│    │  FCM token generated → upserted to device_tokens       │   │
│    │                                                         │   │
│    ├──→ REFRESHED                                            │   │
│    │     FCM rotates the token (periodic,                    │   │
│    │     or on app reinstall).                              │   │
│    │     Handler: upsert new, delete old.                    │   │
│    │                                                         │   │
│    ├──→ INVALIDATED                                          │   │
│    │     Edge Function returns UNREGISTERED                  │   │
│    │     or INVALID_ARGUMENT for this token.                 │   │
│    │     Action: mark is_valid = false, stop delivery.       │   │
│    │                                                         │   │
│    ├──→ REVOKED                                              │   │
│    │     User logs out, deletes account,                     │   │
│    │     or explicitly disables notifications.               │   │
│    │     Action: DELETE FROM device_tokens.                  │   │
│    │                                                         │   │
│    └──→ EXPIRED                                              │   │
│          Token not refreshed after threshold                 │   │
│          (e.g., 30 days since last_used_at).                 │   │
│          Action: marked invalid, periodic cleanup.           │   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.1 Periodic Cleanup Job

A scheduled Edge Function (via Supabase Cron, or a separate cron trigger) should:
1. Query `device_tokens` where `last_used_at < now() - interval '30 days'`
2. Attempt a dry-run send to each stale token
3. Mark tokens as invalid if FCM returns `UNREGISTERED` or `INVALID_ARGUMENT`

---

## 6. Authentication / Security

### 6.1 Token Registration Security

- The `device_tokens` table RLS policy enforces `auth.uid() = user_id` on INSERT.
- The client must be authenticated to register a token.
- Token registration is done via a Supabase RPC function that validates the JWT:

```sql
CREATE OR REPLACE FUNCTION public.register_device_token(
  p_token TEXT,
  p_platform TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.device_tokens (user_id, token, platform)
  VALUES (auth.uid(), p_token, p_platform)
  ON CONFLICT (user_id, platform, token)
  DO UPDATE SET last_used_at = now();
END;
$$;
```

### 6.2 Edge Function Authentication

- The Edge Function uses the `service_role` key to read `device_tokens` (bypasses RLS).
- `service_role` key is stored as a Supabase Secret (not in `.env`).
- The function validates incoming requests via a shared secret or Supabase webhook signature.

### 6.3 FCM API Authentication

- FCM HTTP v1 API uses OAuth 2.0 (Google service account credentials).
- The service account JSON is stored as a Supabase Secret.
- The Edge Function generates an access token on startup and refreshes it as needed.

### 6.4 VAPID Key (Web Push)

- VAPID key pair is generated when configuring Firebase Cloud Messaging for Web.
- Public VAPID key is exposed to the client (safe — it's public by design).
- Private VAPID key is used by FCM servers, never exposed to the client.

### 6.5 Supabase Secrets Required

| Secret Name | Source | Used By |
|-------------|--------|---------|
| `FCM_SERVICE_ACCOUNT_JSON` | Firebase Console | Edge Function |
| `FCM_EDGE_FUNCTION_SECRET` | Generated | DB Trigger → Edge Function |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard | Edge Function |

---

## 7. Firebase Server Architecture

### 7.1 Google Firebase Project

A Firebase project must be created and linked to the same Google Cloud project. Within it:

| Firebase Service | Purpose |
|-----------------|---------|
| **Cloud Messaging** | Send push notifications via FCM HTTP v1 API |
| **Service Account** | Generate OAuth 2.0 credentials for server API calls |
| **Web Push Certificates** | VAPID key pair for web push |

### 7.2 FCM HTTP v1 API Endpoint

The Edge Function calls the FCM HTTP v1 API:

```
POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "message": {
    "token": "device_fcm_token",
    "notification": {
      "title": "عنوان الإشعار",
      "body": "نص الإشعار"
    },
    "data": {
      "type": "new_message",
      "notification_id": "uuid",
      "link": "/chat/conv-uuid",
      "title_ar": "عنوان الإشعار",
      "body_ar": "نص الإشعار"
    },
    "webpush": {
      "fcm_options": {
        "link": "/notifications"
      }
    }
  }
}
```

### 7.3 OAuth 2.0 Token Management

The Edge Function should:
1. On cold start, load the service account JSON from `FCM_SERVICE_ACCOUNT_JSON` secret.
2. Generate an OAuth 2.0 access token using the `google-auth-library` or raw JWT assertion.
3. Cache the token in memory for its lifetime (typically 3600 seconds).
4. The Supabase Edge Function runtime persists global variables across warm starts — use this to avoid regenerating tokens on every invocation.

### 7.4 FCM Message Types

Two message types in the FCM API:

| Type | Fields | Use Case |
|------|--------|----------|
| **Notification** | `notification.title`, `notification.body` | Automatically displayed by OS when app is in background. |
| **Data** | `data.*` key-value pairs | Delivered to the app regardless of foreground/background. App must handle them. |

**Strategy**: Send **both** notification and data payloads in every message. This ensures:
- OS shows the notification automatically when app is in background.
- App can read the full data payload (including `link`, `type`, `notification_id`) when the user taps the notification.

---

## 8. Supabase Integration

### 8.1 Supabase Services Used

| Service | Purpose |
|---------|---------|
| **Database** | `device_tokens` table, `notifications` trigger, `fcm_queue` table |
| **Edge Functions** | FCM delivery logic (send push via FCM API) |
| **Realtime** | Already in use for in-app live notifications (unchanged) |
| **Secrets** | Store FCM service account, webhook secrets |
| **Cron (via pg_cron or Edge Function schedule)** | Periodic token cleanup |

### 8.2 Data Flow (Complete)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COMPLETE PUSH NOTIFICATION FLOW                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 1. USER ACTION (or DB trigger)                                     │
│    Any of the 21 call sites calls:                                  │
│    createNotificationService(supabase).create(type, id, payload)   │
│                                                                     │
│ 2. NOTIFICATIONSERVICE                                              │
│    Validates input → supabase.from('notifications').insert(...)    │
│    Returns NotificationResult to caller                            │
│                                                                     │
│ 3. SUPABASE NOTIFICATIONS TABLE                                     │
│    Row inserted → RLS check passes → trigger fires                 │
│                                                                     │
│ 4. DB TRIGGER → EDGE FUNCTION                                       │
│    Option A: pg_net extension → HTTP POST to Edge Function         │
│    Option B: fcm_queue INSERT → Edge Function polls/cron           │
│                                                                     │
│ 5. SUPABASE EDGE FUNCTION                                           │
│    Receives: { notification_id, user_id, type, title_ar,           │
│                body_ar, link }                                      │
│    a) Queries device_tokens WHERE user_id = recipient              │
│       AND is_valid = TRUE                                          │
│    b) Checks notification preferences (localStorage-style          │
│       but stored in DB — see §8.3)                                 │
│    c) For each valid token, calls FCM HTTP v1 API                  │
│    d) Updates notifications.sent_via_fcm = TRUE                    │
│    e) Marks invalid tokens in device_tokens                        │
│                                                                     │
│ 6. FCM SERVERS                                                      │
│    Routes message to appropriate platform:                         │
│    - Web: FCM → Browser Service Worker                             │
│    - Android: FCM → FCM SDK → System Tray                          │
│    - iOS: FCM → APNs → iOS Notification Center                     │
│                                                                     │
│ 7. CLIENT (BACKGROUND)                                              │
│    Service Worker receives push event → shows system notification  │
│    User taps → opens app → navigates to link                       │
│                                                                     │
│ 8. CLIENT (FOREGROUND)                                              │
│    onMessage handler fires → shows in-app toast                    │
│    Updates notification list via Realtime subscription             │
│    Updates unread count badge                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.3 Preference Checking

Currently, notification preferences are stored **only in localStorage** (`miftah_notif_prefs` key). The Edge Function cannot access the user's localStorage. Two options:

**Option A (Recommended): Store preferences in the database.**

Add a `notification_preferences` column to the `profiles` table or a new `user_notification_prefs` table.

```sql
-- Option A1: Add JSONB column to profiles
ALTER TABLE public.profiles
  ADD COLUMN notification_prefs JSONB DEFAULT '{
    "new_response": true,
    "listing_expiring": true,
    "listing_approved": true,
    "listing_rejected": true,
    "verification_update": true,
    "new_report": true,
    "system": true
  }';

-- Option A2: Separate table
CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  prefs   JSONB NOT NULL DEFAULT '{}',
  CHECK (prefs ? 'new_response' AND prefs ? 'listing_expiring' ...)
);
```

The Edge Function queries `notification_preferences` before sending. If the user has disabled the notification type, the push is skipped.

**Implication**: The `SettingsPage` currently saves preferences to localStorage only. It must be updated to also (or instead) save to the database. See §24.7.

**Option B (Not recommended):** Pass preferences as part of the notification creation payload. This would require modifying all 21 call sites and the `create()` interface.

---

## 9. Edge Functions vs Alternatives

### 9.1 Comparison

| Approach | Latency | Complexity | Cost | Reliability | Maintainability |
|----------|---------|-----------|------|-------------|-----------------|
| **Supabase Edge Function** (Deno) | ~100-500ms first call (cold start), ~10-50ms warm | Medium | Free tier included | High (managed by Supabase) | High (TypeScript, same repo) |
| **Node.js server (self-hosted/VPS)** | Low | High (need hosting, CI/CD, monitoring) | Server cost | Depends on setup | Medium |
| **Supabase DB function (plpgsql → pg_net)** | Low (same DB) | Medium (pg_net extension) | Free | High | Low (plpgsql HTTP calls are hard to debug) |
| **Zapier / Make webhook** | Medium | Low | Paid per task | Low (third-party) | Low |

### 9.2 Recommendation: Supabase Edge Function

**Primary**: A single Edge Function (`send-fcm`) that:
- Receives notification data from the DB trigger
- Queries `device_tokens` and `notification_preferences`
- Sends FCM messages
- Reports back failures

**Rationale**:
- Runs in the same Supabase project — no extra infrastructure
- Deno runtime supports `npm:` specifiers for `google-auth-library`
- Edge Functions can be invoked via DB trigger using `pg_net`
- Rate limits are generous for notification workloads
- Can be scheduled via Supabase Cron for token cleanup

### 9.3 Edge Function Signature

```
Name:     send-fcm
Method:   POST
Auth:     Secret header (X-FCM-Secret) matching FCM_EDGE_FUNCTION_SECRET
Body:
{
  "notification_id": "uuid",
  "user_id": "uuid",
  "type": "new_message",
  "title_ar": "عنوان الإشعار",
  "body_ar": "نص الإشعار",
  "link": "/chat/conv-123"
}

Response (200):
{
  "delivered": 2,
  "failed": 0,
  "invalid_tokens": []
}

Response (4xx/5xx):
{
  "error": "description",
  "retryable": true/false
}
```

---

## 10. Retry Strategy

### 10.1 When to Retry

| FCM Error Code | Retry? | Backoff |
|----------------|--------|---------|
| `UNREGISTERED` | No | — |
| `INVALID_ARGUMENT` | No | — |
| `SENDER_ID_MISMATCH` | No | — |
| `THIRD_PARTY_AUTH_ERROR` | No (requires manual fix) | — |
| `UNAVAILABLE` | Yes | Exponential backoff |
| `INTERNAL` | Yes | Exponential backoff |
| `QUOTA_EXCEEDED` | Yes | Exponential backoff (longer) |
| Network/timeout | Yes | Exponential backoff |

### 10.2 Retry Implementation

Using the `fcm_queue` table:

```
1. Edge Function picks up pending rows (status = 'pending')
2. Attempts FCM send
3a. Success → status = 'sent', processed_at = now()
3b. Retryable failure → retry_count++, status = 'pending',
    next_attempt = now() + (2^retry_count * 10 seconds)
3c. Non-retryable failure → status = 'failed', last_error = error message
4. After max_retries → status = 'failed'
5. Cron job retries failed rows every 15 minutes
```

### 10.3 Retry Backoff Schedule

| Retry # | Delay |
|---------|-------|
| 1 | 10 seconds |
| 2 | 20 seconds |
| 3 | 40 seconds |
| 4 | 80 seconds |
| 5 (max) | 160 seconds (~2.5 min) |

Total retry window: ~5 minutes. After that, the notification is marked as permanently failed and logged for monitoring.

---

## 11. Duplicate Prevention

### 11.1 Scenario

Duplicates can occur when:
- DB trigger fires multiple times (rare, but possible with PG replication)
- Edge Function retries a request that already partially succeeded
- User has multiple tabs open (same FCM token)
- User has multiple devices (different tokens — these are NOT duplicates; each device should receive the notification)

### 11.2 Deduplication Strategy

**Level 1**: Edge Function dedup by `notification_id`.

```typescript
// Check if this notification was already sent
const { data } = await supabase
  .from('notifications')
  .select('sent_via_fcm')
  .eq('id', notification_id)
  .single();

if (data?.sent_via_fcm) {
  console.log(`Notification ${notification_id} already sent, skipping`);
  return { skipped: true };
}
```

**Level 2**: Idempotency key in FCM API.

FCM supports an `fcm_options.analytics_label` that can serve as an idempotency key. Alternatively, the `token` + `notification_id` combination is naturally unique because each token receives the message once.

**Level 3**: Queue table dedup with unique constraint.

```sql
ALTER TABLE public.fcm_queue
  ADD CONSTRAINT uq_fcm_queue_notification UNIQUE (notification_id);
```

### 11.3 Same Token Across Tabs

Multiple browser tabs for the same user share the same FCM token (the service worker handles it). The Edge Function will only send one push per token. No additional dedup needed.

---

## 12. Failure Handling

### 12.1 Failure Scenarios

| Scenario | Detection | Action |
|----------|-----------|--------|
| FCM token expired/invalid | FCM returns UNREGISTERED | Mark token invalid in device_tokens |
| User revoked permission | FCM returns SENDER_ID_MISMATCH | Mark token invalid |
| FCM service unavailable | FCM returns UNAVAILABLE | Retry with backoff |
| Edge Function cold start failure | Function throws on init | Retry (calling trigger will retry) |
| Database connection error | supabase.from() throws | Retry with backoff |
| Quota exceeded | FCM returns QUOTA_EXCEEDED | Retry with longer backoff, alert monitoring |
| User has no tokens | Edge Function queries empty result set | Skip silently (no push needed) |
| All notification types disabled | Preference check returns false | Skip silently |

### 12.2 Monitoring

Add a `fcm_delivery_log` table for observability (optional, low-priority):

```sql
CREATE TABLE public.fcm_delivery_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  token_id        UUID REFERENCES public.device_tokens(id) ON DELETE SET NULL,
  status          TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_code      TEXT,
  error_message   TEXT,
  fcm_response    JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 12.3 Alerting

Configure Supabase Monitoring / Sentry / custom alert when:
- `fcm_delivery_log` has > 5% failure rate in 5 minutes
- `fcm_queue` has rows pending for > 10 minutes
- Edge Function invocation error rate > 1%

---

## 13. Offline Behavior

### 13.1 Sender Offline

The notification creator (e.g., an admin or user performing an action) may be offline, but the database insert will succeed once connectivity is restored. The DB trigger fires on successful INSERT. Push delivery is decoupled from the sender — it proceeds independently.

### 13.2 Recipient Offline

| State | Behavior |
|-------|----------|
| Recipient's device offline when push is sent | FCM queues the message. Default TTL is 28 days. Message is delivered when the device comes online. |
| Device offline > 28 days | FCM drops the message. No delivery. |
| Browser closed, Service Worker not registered | Push cannot be delivered until a service worker is registered on next visit. |
| Mobile app not installed | No push (only registered tokens receive pushes). |

### 13.3 FCM TTL Configuration

Set a Time-To-Live (TTL) for each message:

```json
{
  "message": {
    "token": "...",
    "notification": { ... },
    "data": { ... },
    "webpush": {
      "headers": {
        "TTL": "86400"
      }
    },
    "android": {
      "ttl": "86400s"
    },
    "apns": {
      "headers": {
        "apns-expiration": "86400"
      }
    }
  }
}
```

Recommended TTL: **86400 seconds (24 hours)**. Notifications older than 24 hours are likely irrelevant.

### 13.4 Preference-Respecting Delivery

The Edge Function checks preferences **at send time**, not at notification creation time. If a user disables `new_message` notifications while offline, and a `new_message` notification was queued — it will be skipped when the Edge Function processes the queue after the user comes online and the preference is saved.

---

## 14. Background Delivery

### 14.1 When App Is in Background

FCM notification messages (`notification` field) are automatically displayed by the OS/browser when the app is in the background.

**Web (background tab or minimized)**:
1. FCM sends the push message.
2. Browser's service worker receives the `push` event.
3. Service worker calls `self.registration.showNotification(title, options)`.
4. OS/browser displays the system notification.
5. User clicks → service worker `notificationclick` event fires.
6. Service worker opens/clients.openWindow the app URL from notification data.
7. App navigates to the `link` from the notification data payload.

**Service Worker push event handler**:

```typescript
// Pseudocode for sw.ts/tsx compiled to sw.js
self.addEventListener('push', (event) => {
  const data = event.data?.json();
  if (!data) return;

  const { title_ar, body_ar, type, link } = data;

  event.waitUntil(
    self.registration.showNotification(title_ar, {
      body: body_ar,
      icon: '/favicon.png',
      badge: '/badge-icon.png',
      data: { link, type, notification_id: data.notification_id },
      tag: data.notification_id, // prevents duplicate notifications
      renotify: false,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window or open new one
        const client = clientList.find(c => c.url.includes(link) && 'focus' in c);
        if (client) return client.focus();
        if (clients.openWindow) return clients.openWindow(link || '/');
      })
  );
});
```

### 14.2 Badge Count Update in Background

FCM data payload can include `unread_count`. The service worker can update the badge via the `Badge API` (`navigator.setAppBadge` or `navigator.setClientBadge`).

**Limitation**: The Badge API is not supported in all browsers (supported in Chrome on desktop and Android, not Safari). Degrade gracefully.

---

## 15. Foreground Delivery

### 15.1 When App Is in Foreground

When the app is open and visible, FCM notification messages are **not automatically displayed** by the browser. Instead, the `onMessage` callback fires in the app context.

**Web**:

```typescript
// Pseudocode — in a context or hook
import { getMessaging, onMessage } from 'firebase/messaging';

const messaging = getMessaging(app);

onMessage(messaging, (payload) => {
  // payload.notification.title
  // payload.notification.body
  // payload.data.type, payload.data.link, etc.

  // Option A: Show sonner toast (recommended)
  toast(payload.notification?.title || payload.data?.title_ar, {
    description: payload.notification?.body || payload.data?.body_ar,
    action: payload.data?.link ? {
      label: 'عرض',
      onClick: () => navigate(payload.data.link),
    } : undefined,
  });

  // Option B: Update notification page data
  // (Realtime subscription already handles this,
  //  but the push data has the notification immediately)

  // Update unread count
  queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
});
```

**Also**: The existing Realtime subscription on the `notifications` table (§8, flow path) continues to work in parallel. This adds redundancy — if FCM delivery fails or is delayed, the Realtime subscription will still pick up the new notification row.

### 15.2 Preventing Duplicate UI Updates

When the app is in the foreground, both paths fire:
1. `onMessage` (FCM) — fires immediately when push is received
2. Realtime subscription (Supabase) — fires within ~100-500ms

**Deduplication strategy**: Use the `notification_id` from the FCM data payload. If the notification is already in the local state (from Realtime), skip the toast.

```typescript
// Track recently received notification IDs
const recentIds = useRef<Set<string>>(new Set());

onMessage(messaging, (payload) => {
  const id = payload.data?.notification_id;
  if (id && recentIds.current.has(id)) return;
  if (id) recentIds.current.add(id);

  // Show toast
  // Clear from set after a few seconds
  setTimeout(() => recentIds.current.delete(id), 3000);
});
```

---

## 16. Web Support

### 16.1 Web Push Protocol

FCM for Web uses the standard Web Push protocol with VAPID authentication.

| Step | Detail |
|------|--------|
| Browser support | Chrome (desktop + Android), Firefox, Edge, Opera, Samsung Internet |
| Not supported | Safari (partial — supports Web Push as of Safari 16 but FCM SDK for Safari is limited) |
| Fallback | In-app notification page (already exists) |

### 16.2 Service Worker

A service worker file must be created and registered.

**Key points**:
- The service worker must be served from the root of the domain (or within the `public/` directory).
- Vite-based projects typically place `public/firebase-messaging-sw.js` or compile a TS service worker.
- The service worker imports `firebase-messaging-sw.js` from the Firebase SDK CDN.
- Two approaches:

**Option A (Recommended): Static JS service worker** in `public/firebase-messaging-sw.js`

```javascript
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.x/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.x/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...',
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  const { title_ar, body_ar, link, notification_id } = payload.data;
  const notificationTitle = title_ar || payload.notification?.title;
  const notificationBody = body_ar || payload.notification?.body;

  self.registration.showNotification(notificationTitle, {
    body: notificationBody,
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { link, notification_id },
    tag: notification_id,
  });
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/notifications';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      const client = windowClients.find(c => 'focus' in c);
      if (client) return client.focus();
      return clients.openWindow(link);
    })
  );
});
```

**Option B: Vite-compiled service worker** using `vite-plugin-pwa` or manual build step.

### 16.3 Firebase Config for Web

Firebase config values (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`) are public and safe to embed in the client. They identify the Firebase project but do not grant access.

### 16.4 VAPID Key

Generated in Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates. The public key is used in the client:

```typescript
const token = await getToken(messaging, {
  vapidKey: 'BP...public_vapid_key...',
});
```

### 16.5 Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| Safari poor FCM support | iOS/iPadOS Safari cannot receive web push | Show in-app banner directing users to install PWA; mobile users receive push via native app wrapper (if any) |
| HTTPS required | Web Push requires HTTPS (localhost exempt in dev) | Production must be HTTPS — already required for Supabase |
| Service Worker scope | SW only controls pages under its registration path | Register SW at root (`/`) scope |
| Notification permission | User must grant permission | Request permission with clear explanation in user's language; handle denial gracefully |

---

## 17. Android Support

### 17.1 Current State

This is a web application (React SPA), not a native Android app. Android support is via:

| Method | Feasibility | Notes |
|--------|-------------|-------|
| **Chrome on Android** (Web Push) | ✅ Supported | Chrome on Android receives FCM web push via service worker |
| **PWA (Add to Home Screen)** | ✅ Supported | PWA on Android receives web push like Chrome |
| **Trusted Web Activity (TWA)** | ⚠️ Possible | Wraps the PWA as a Play Store app; push still uses web push |
| **React Native / Kotlin** | ❌ Out of scope | This is a web project, not a native app |

### 17.2 Android Web Push Behavior

| Scenario | Behavior |
|----------|----------|
| Chrome open, foreground | `onMessage` fires (same as §15) |
| Chrome open, background tab | Service worker handles push event, shows system notification |
| Chrome closed | Service worker may still run briefly (Android kills it aggressively) |
| Chrome killed from recents | No delivery — next time user opens Chrome, `onTokenRefresh` fires, stale token is detected and cleaned |

### 17.3 PWA Manifest

The PWA manifest (if created) should include:
```json
{
  "name": "مُكتري",
  "display": "standalone",
  "gcm_sender_id": "482941778795",
  "gcm_user_visible_only": true
}
```

Note: `gcm_sender_id` is used by legacy FCM for Android web push.

---

## 18. iOS Support

### 18.1 Current State

Same as Android — this is a web app. iOS support is via Safari/chrome web push and PWA.

### 18.2 iOS Web Push Limitations

| Limitation | Detail |
|-----------|--------|
| Safari Web Push | Supported since Safari 16 on macOS, iOS 16.4+ |
| FCM on Safari | Firebase Messaging SDK has limited Safari support — the `getToken()` call may fail |
| Chrome on iOS | Uses WebKit engine; Chrome on iOS uses Safari's push infrastructure |
| PWA on iOS | PWAs can receive push notifications since iOS 16.4 |
| APNs requirement | FCM on iOS ultimately routes through APNs. This is handled by Firebase — no extra work |

### 18.3 Recommendation for iOS

| Priority | Approach | Effort |
|----------|----------|--------|
| 1 | Support web push via service worker + FCM (handles Safari/Chrome if Firebase SDK supports it) | Low |
| 2 | Fallback to in-app notification page (already exists) | None |
| 3 | Native iOS app wrapper via Capacitor/Cordova | High (separate project) |

Phase 1: Web push for supported browsers. iOS users who cannot receive web push will rely on the in-app notification page (existing behavior).

---

## 19. Performance Considerations

### 19.1 Edge Function Performance

| Concern | Mitigation |
|---------|-----------|
| Cold starts | Edge Functions cold start in ~100-500ms. Notification delivery is not user-facing latency — it can tolerate this. |
| Token query per notification | Query `device_tokens` by indexed `user_id` — returns in <5ms for typical user (1-3 tokens). |
| FCM API call latency | Each `POST` to FCM takes ~50-200ms. Batch calls are not supported by FCM — must call per token. A user with 3 devices means 3 API calls (150-600ms total). |
| Supabase connection pool | Edge Functions share the pool. Notification delivery is async and low-volume — no impact. |

### 19.2 Client Performance

| Concern | Mitigation |
|---------|-----------|
| Firebase SDK bundle size | Firebase Messaging SDK is ~25KB gzipped. Lazy-load via dynamic import — do not include in main bundle. |
| Service worker memory | Service worker runs in its own context, minimal memory (~1-2MB). |
| Concurrent Realtime + FCM | Both paths fire simultaneously for foreground — dedup handles it (§15.2). |
| Token registration on every page load | Only register once per session. Use `getToken()` result cached in memory; only upsert to DB on change. |

### 19.3 Database Performance

| Concern | Mitigation |
|---------|-----------|
| `device_tokens` per user | Typically 1-3 tokens per user. No scalability concern. |
| `fcm_queue` table growth | Processed rows should be archived/deleted after 7 days. Add a cron cleanup job. |
| `fcm_delivery_log` table growth | Auto-delete rows older than 30 days. Use PG partitioning if volume grows. |

### 19.4 Rate Limits

| Service | Limit | Mitigation |
|---------|-------|------------|
| FCM HTTP v1 API | 600 requests/min per project (default) | Our volume is well below this. Request increase if needed. |
| Supabase Edge Functions | Varies by plan (Free: 500K invocations/mo, Pro: 2M/mo) | Each notification = 1 invocation. Monitor usage. |
| Supabase Database | 60 req/s (Free), 120 req/s (Pro) | device_tokens queries are minimal and indexed. |

---

## 20. Security Considerations

### 20.1 Service Account Credentials

| Item | Risk | Mitigation |
|------|------|------------|
| FCM service account JSON stored as Supabase Secret | Secret exposure | Never log it. Edge Function reads from Deno.env only. |
| Service account has `firebase.messaging.create` permission | Misuse | Restrict service account roles to only FCM; use separate service account for this purpose. |
| `service_role` key for Edge Function | Can bypass all RLS | Never expose `service_role` key to client. Store as Supabase Secret. |

### 20.2 Client Security

| Item | Risk | Mitigation |
|------|------|------------|
| FCM token exposed in browser | Token is device-specific; misuse would only send pushes to that user's device | Treat token as user-specific but not secret (it's already in the browser). |
| Notification permission prompt | Users may be suspicious | Show a clear explanation (in Arabic) before requesting permission. Example: "نود إرسال إشعارات لتنبيهك بالرسائل والتحديثات الجديدة" |
| VAPID public key is public | It's meant to be public | Use private key only in Firebase Console, never in client. |

### 20.3 Edge Function Security

| Item | Mitigation |
|------|------------|
| Edge Function exposed publicly | Validate incoming request via `X-FCM-Secret` header matching Supabase Secret. Reject invalid requests with 401. |
| Edge Function called by unauthorized trigger | The DB trigger is SECURITY DEFINER — only Supabase internal calls it. |
| Edge Function logs sensitive data | Sanitize logs: mask FCM tokens, do not log service account JSON. |

### 20.4 RLS Policies

- `device_tokens` RLS ensures users can only read/insert/delete their own tokens.
- The Edge Function uses `service_role` key (bypasses RLS) to read tokens for delivery.
- No modification RLS policies are needed on `device_tokens` for the Edge Function — it reads only.

### 20.5 Data Protection

| Data | Classification | Handling |
|------|---------------|----------|
| FCM token | PII (device identifier) | Stored in DB with RLS. Not exposed to other users. |
| Notification content | User communication | Already in `notifications` table (existing). FCM payload is encrypted in transit. |
| User ID | PII | Already exposed in `notifications.user_id`. No change. |

---

## 21. Required Environment Variables

### 21.1 Client-Side (`.env`)

```bash
# Existing:
VITE_SUPABASE_URL="https://xxxx.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."

# New:
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="project-id"
VITE_FIREBASE_STORAGE_BUCKET="project.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123456789:web:abc123"
VITE_FIREBASE_VAPID_KEY="BP...public_vapid_key..."
```

### 21.2 Supabase Secrets (for Edge Function)

```bash
# Set via Supabase CLI or Dashboard:
supabase secrets set FCM_SERVICE_ACCOUNT_JSON='{...}'
supabase secrets set FCM_EDGE_FUNCTION_SECRET='random-64-char-string'
supabase secrets set FCM_DEFAULT_TTL_SECONDS='86400'
supabase secrets set FCM_MAX_RETRIES='5'
supabase secrets set FCM_QUEUE_POLL_INTERVAL_SECONDS='30'
```

### 21.3 VAPID Key

Generated in: Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates → Generate Key Pair.

- Public key → `VITE_FIREBASE_VAPID_KEY` (client env)
- Private key → Stored in Firebase, never in application config

---

## 22. File-by-File Modification List

### 22.1 Summary

| Category | New Files | Modified Files |
|----------|-----------|----------------|
| **Infrastructure** | 1 | 0 |
| **Database** | 0 | 0 (migration SQL files) |
| **Service Layer** | 2 | 0 |
| **Client** | 2 | 7 |
| **Edge Function** | 3 | 0 |
| **Configuration** | 0 | 2 |
| **Total** | **8** | **9** |

### 22.2 Detailed List

| # | File | Action | Change Summary |
|---|------|--------|----------------|
| 1 | `supabase/migrations/<timestamp>_fcm_device_tokens.sql` | **New** | Create `device_tokens` table, RLS, indexes. |
| 2 | `supabase/migrations/<timestamp>_fcm_notifications_columns.sql` | **New** | Add `sent_via_fcm`, `fcm_sent_at` to `notifications`. |
| 3 | `supabase/migrations/<timestamp>_fcm_queue.sql` | **New** | Create `fcm_queue` table, indexes, trigger function. |
| 4 | `supabase/migrations/<timestamp>_notification_preferences.sql` | **New** | Add `notification_prefs` column to `profiles`, or create separate table. |
| 5 | `public/firebase-messaging-sw.js` | **New** | Static service worker for FCM background messages. |
| 6 | `src/services/FcmService.ts` | **New** | FCM client service — token registration, permission request, message handler. |
| 7 | `src/services/DeviceTokenService.ts` | **New** | Token CRUD with Supabase — register, refresh, revoke. |
| 8 | `supabase/functions/send-fcm/index.ts` | **New** | Edge Function — receives notification data, queries tokens, calls FCM API. |
| 9 | `supabase/functions/send-fcm/utils/fcm.ts` | **New** | FCM API helper — OAuth token generation, message construction. |
| 10 | `supabase/functions/send-fcm/utils/retry.ts` | **New** | Retry logic with exponential backoff. |
| 11 | `src/services/index.ts` | **Modify** | Export `FcmService`, `DeviceTokenService`, types. |
| 12 | `src/types/notifications.ts` | **Modify** | Add FCM-related types: `DeviceToken`, `FcmMessage`, `FcmDeliveryResult`. |
| 13 | `src/main.tsx` | **Modify** | Register service worker on app boot. |
| 14 | `src/contexts/AuthContext.tsx` | **Modify** | Revoke device tokens on logout. |
| 15 | `src/hooks/useFcmToken.ts` | **New** | Hook — manages FCM token lifecycle tied to auth state. |
| 16 | `src/hooks/useFcmForegroundMessage.ts` | **New** | Hook — listens for foreground messages via `onMessage`. |
| 17 | `src/pages/SettingsPage.tsx` | **Modify** | Add FCM permission request section. Add "notification devices" management. |
| 18 | `.env` | **Modify** | Add Firebase config vars. |
| 19 | `.env.example` | **New** | Template with all required env vars. |
| 20 | `src/types/notifications.ts` | **Modify** | Add `NotificationPreferencesDB` type, update `NotificationServiceInterface`. |

---

## 23. New Files to Create

### 23.1 `public/firebase-messaging-sw.js`

Static service worker file. No build step. Imports Firebase SDK via `importScripts`. Handles `onBackgroundMessage` and `notificationclick`.

### 23.2 `src/services/FcmService.ts`

Client-side service that wraps `firebase/messaging`:

```typescript
export class FcmService {
  private messaging: Messaging | null = null;
  private app: FirebaseApp | null = null;

  async initialize(firebaseConfig: FirebaseConfig): Promise<void>;
  async requestPermission(): Promise<NotificationPermission>;
  async getToken(vapidKey: string): Promise<string>;
  async deleteToken(): Promise<void>;
  onMessage(handler: (payload: MessagePayload) => void): () => void; // unsubscribe
  isSupported(): boolean; // checks if browser supports FCM
}
```

### 23.3 `src/services/DeviceTokenService.ts`

```typescript
export class DeviceTokenService {
  constructor(private supabase: SupabaseClient);
  async register(token: string, platform: 'web' | 'android' | 'ios'): Promise<void>;
  async unregister(token: string): Promise<void>;
  async removeAllForUser(userId: string, platform?: string): Promise<void>;
  async getAllForUser(): Promise<DeviceToken[]>;
}
```

### 23.4 `src/hooks/useFcmToken.ts`

```typescript
export function useFcmToken(): {
  fcmToken: string | null;
  permission: NotificationPermission | null;
  isSupported: boolean;
  requestPermission: () => Promise<void>;
  error: string | null;
};
```

- On mount: check if FCM is supported, get existing token.
- On auth state change: register token when user logs in, revoke on logout.
- On token refresh: upsert new token, delete old.

### 23.5 `src/hooks/useFcmForegroundMessage.ts`

```typescript
export function useFcmForegroundMessage(): void;
```

- Registers `onMessage` handler.
- Shows sonner toast with notification data.
- Handles deduplication with Realtime subscription.

### 23.6 `supabase/functions/send-fcm/index.ts`

Main Edge Function entry point.

### 23.7 `supabase/functions/send-fcm/utils/fcm.ts`

FCM API utilities — OAuth token generation, message construction, response parsing.

### 23.8 `supabase/functions/send-fcm/utils/retry.ts`

Exponential backoff retry logic.

### 23.9 `supabase/functions/send-fcm/utils/preferences.ts`

Preference checking — queries `notification_preferences` from Supabase.

---

## 24. Existing Files to Modify

### 24.1 `src/services/index.ts`

Add exports:
```typescript
export { FcmService } from './FcmService';
export { DeviceTokenService } from './DeviceTokenService';
export type { DeviceToken, FcmMessagePayload, FcmDeliveryResult } from '@/types/notifications';
```

### 24.2 `src/types/notifications.ts`

Add types:
- `DeviceToken`: `{ id, userId, token, platform, lastUsedAt, createdAt, isValid }`
- `FcmMessagePayload`: `{ notificationId, type, titleAr, bodyAr, link }`
- `FcmDeliveryResult`: `{ notificationId, delivered, failed, invalidTokens }`
- `NotificationPreferencesDB`: JSON structure for DB-stored preferences

### 24.3 `src/main.tsx`

Add service worker registration:
```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then(() => console.log('FCM Service Worker registered'))
    .catch((err) => console.error('FCM SW registration failed', err));
}
```

### 24.4 `src/contexts/AuthContext.tsx`

In the `signOut` function, add:
```typescript
// Revoke FCM token on logout
const deviceTokenService = new DeviceTokenService(supabase);
const fcmService = new FcmService();
const token = await fcmService.getToken(VAPID_KEY);
if (token) {
  await deviceTokenService.unregister(token);
  await fcmService.deleteToken();
}
```

### 24.5 `src/pages/SettingsPage.tsx`

Add to the notification preferences section:
- "تفعيل الإشعارات الفورية" toggle (request notification permission)
- Display current permission state
- List of registered devices (from `device_tokens`)
- "إلغاء تسجيل الأجهزة" option

### 24.6 `.env`

Add Firebase configuration variables from §21.1.

### 24.7 `src/services/NotificationService.ts` (preferences)

Modify `setPreferences()` to also persist to the database:

```typescript
async setPreferences(prefs: NotificationPreferences): Promise<void> {
  // Existing localStorage logic (keep as-is)
  localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));

  // NEW: Also persist to DB for Edge Function access
  await this.supabase
    .from('profiles')
    .update({ notification_prefs: prefs })
    .eq('id', currentUserId); // need to determine current user
}
```

**Important**: The `NotificationService` currently does not know the current user's ID. The `createNotificationService` factory would need to accept a `userId` parameter, OR a separate call would be needed. Consider passing `userId` to the factory:

```typescript
// Current factory
export function createNotificationService(
  supabase: SupabaseClient,
  config?: NotificationServiceConfig
): NotificationServiceInterface

// Updated factory
export function createNotificationService(
  supabase: SupabaseClient,
  userId?: string,          // NEW: for preference persistence
  config?: NotificationServiceConfig
): NotificationServiceInterface
```

Alternatively, the `SettingsPage.tsx` can call the DB directly without modifying `NotificationService`:

```typescript
// In SettingsPage toggleNotifPref:
const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
setNotifPrefs(updated);
try {
  createNotificationService(supabase).setPreferences(updated);
  // NEW: Also persist to DB
  await supabase.from('profiles').update({ notification_prefs: updated }).eq('id', user.id);
} catch { ... }
```

---

## 25. Migration Strategy

### 25.1 Phased Rollout

```
Phase 1: Infrastructure (non-breaking)
├── Firebase project setup
├── Supabase migrations (device_tokens, queue, prefs)
├── Edge Function scaffolding
├── Service worker file
└── Environment variables

Phase 2: Client registration (non-breaking)
├── FcmService, DeviceTokenService
├── useFcmToken hook
├── Service worker registration in main.tsx
└── Token registration on login

Phase 3: Delivery pipeline (behind feature flag)
├── Deploy Edge Function (send-fcm)
├── DB trigger → Edge Function connection
├── Preference checking in Edge Function
└── Test with internal accounts

Phase 4: Foreground handling (non-breaking)
├── useFcmForegroundMessage hook
├── Sonner toast on foreground push
└── Deduplication with Realtime

Phase 5: Background handling (non-breaking)
├── Service worker push handler
├── notificationclick handler
└── Badge update

Phase 6: Settings UI (non-breaking)
├── Permission request UI
├── Device management UI
└── Preference sync to DB

Phase 7: Hardening
├── Retry queue monitoring
├── Token cleanup cron
├── Analytics/dashboard for delivery rates
├── Error alerting
└── Load testing
```

### 25.2 Feature Flag

Use a feature flag (e.g., `VITE_FCM_ENABLED` env var) to control whether FCM is active:

```typescript
// In useFcmToken.ts
const isFcmEnabled = import.meta.env.VITE_FCM_ENABLED === 'true';

if (!isFcmEnabled) {
  return { fcmToken: null, permission: null, isSupported: false, requestPermission: () => {}, error: null };
}
```

### 25.3 Data Migration

Existing users have no `device_tokens` rows. After Phase 2 deployment, tokens will be registered the next time each user opens the app. The `device_tokens` table will populate gradually. No bulk migration needed.

Existing `notifications` rows will have `sent_via_fcm = NULL`. This is fine — the column defaults to `FALSE` and existing notifications won't be retroactively sent as push.

Existing `profiles` rows will have `notification_prefs = NULL`. The Edge Function treats NULL as "use defaults" (all enabled).

### 25.4 Backward Compatibility

- All existing notification behavior is preserved.
- Users who do not grant notification permission simply won't receive pushes — the in-app flow works exactly as before.
- Users on browsers that don't support FCM fall back to in-app notifications (existing behavior).
- The Realtime subscription continues to work in parallel with FCM.

---

## 26. Rollback Strategy

### 26.1 Rollback by Phase

| Phase | Rollback Action | Data Loss |
|-------|----------------|-----------|
| 1 | Remove env vars, revert migrations (`supabase migration down`), remove SW file | None |
| 2 | Revert `main.tsx`, `AuthContext.tsx`, remove service files | `device_tokens` rows become orphaned (can be cleaned later) |
| 3 | Disable/delete Edge Function, remove DB trigger | `fcm_queue` rows orphaned |
| 4 | Remove `useFcmForegroundMessage` hook, revert imports | None |
| 5 | Remove `firebase-messaging-sw.js` | None |
| 6 | Revert SettingsPage changes | `notification_prefs` column in profiles stays (no harm) |
| 7 | No rollback needed (monitoring/alerting only) | None |

### 26.2 Quick Rollback (Any Phase)

1. Delete or comment out the Edge Function.
2. Drop the DB trigger: `DROP TRIGGER IF EXISTS trg_notify_fcm_delivery ON notifications;`
3. Remove the service worker file from `public/`.
4. Revert `.env` to remove Firebase config.

**Result**: All in-app notification functionality continues working unchanged. FCM push simply stops being sent.

### 26.3 Full Rollback

```bash
supabase migration down <fcm_timestamp>  # Revert device_tokens, queue, columns
git checkout -- src/                      # Revert all source changes
git checkout -- public/                   # Remove SW
git checkout -- .env                      # Restore original env
git checkout -- supabase/functions/       # Remove Edge Functions
```

---

## 27. Testing Strategy

### 27.1 Unit Tests

| Test Suite | File | What to Test |
|------------|------|-------------|
| `FcmService` | `src/services/__tests__/FcmService.test.ts` | Token lifecycle, permission request, message handler registration |
| `DeviceTokenService` | `src/services/__tests__/DeviceTokenService.test.ts` | CRUD operations with mocked Supabase client |
| `send-fcm Edge Function` | `supabase/functions/send-fcm/index.test.ts` | Token querying, preference checking, FCM API call construction, retry logic |
| Retry logic | `supabase/functions/send-fcm/utils/retry.test.ts` | Backoff calculation, max retries |

### 27.2 Integration Tests

| Test | What to Verify |
|------|---------------|
| DB trigger fires on INSERT | Insert a notification → verify `fcm_queue` row is created |
| Edge Function processes queue | Insert into `fcm_queue` → invoke Edge Function → verify `fcm_queue` status changes |
| FCM API mock call | Mock FCM endpoint → verify correct payload shape, headers, auth |
| Token cleanup | Mark token invalid → verify Edge Function skips it |

### 27.3 End-to-End Tests

| Test | Platform | Verification |
|------|----------|-------------|
| Grant notification permission | Chrome desktop | Permission prompt shown, token registered in `device_tokens` |
| Receive push in background | Chrome desktop | System notification appears |
| Receive push in foreground | Chrome desktop | Sonner toast appears, no duplicate |
| Click notification | Chrome desktop | App opens and navigates to correct link |
| Revoke permission | Chrome desktop | Token removed, pushes stop |
| Logout + login | Chrome desktop | Old token revoked, new token registered |
| Disable notification type | Settings page | Edge Function skips pushes for disabled types |

### 27.4 Testing with Supabase Local

```bash
supabase start
supabase functions serve send-fcm --env-file ./supabase/.env.local
```

Test the trigger locally:
```sql
INSERT INTO notifications (user_id, type, title_ar, body_ar)
VALUES ('existing-user-uuid', 'system', 'Test', 'Test body');
-- → verify fcm_queue has new row
-- → verify Edge Function was called
```

### 27.5 Testing FCM Without Real Devices

Use Firebase Console → Cloud Messaging → Send Test Message to verify that the FCM API key, service account, and project are correctly configured. This sends a push to a specific token without needing the Edge Function.

### 27.6 Existing Tests (Must Remain Passing)

All 56 existing tests must continue to pass. FCM tests are additive — they do not modify existing test coverage.

---

## 28. Risks

### 28.1 High Impact

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Database trigger errors crash notification inserts** | Low | **Critical** — notifications stop working entirely | Use `AFTER INSERT` trigger (not `BEFORE`). Wrap trigger body in `BEGIN ... EXCEPTION ... END`. If trigger fails, the INSERT still succeeds. Push is skipped, in-app notifications work. |
| **Edge Function introduces latency to notification creation** | Low | Medium | The trigger is async (pg_net or queue-based). No synchronous call path. The INSERT to `notifications` returns immediately before the Edge Function runs. |
| **FCM service account exposed** | Low | **Critical** — attacker can send arbitrary pushes | Store as Supabase Secret. Never log it. Use a dedicated service account with minimal permissions. Rotate annually. |
| **Service worker update breaks existing notification page** | Medium | Medium | Service worker is in a separate file. It does not import or affect the React app. The only interaction is via `onMessage` → toast. Test thoroughly. |

### 28.2 Medium Impact

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Users overwhelmed by push notifications** | Medium | Medium | Respect notification preferences. Default all to true, but users can disable per-type. |
| **Notification permission prompt blocked by browser** | Medium | Low | Only request permission after user interaction. Show a pre-permission dialog explaining why. |
| **Multiple browser tabs cause duplicate FCM tokens** | High | Low | The FCM token is the same across tabs (per origin). The upsert on `(user_id, platform, token)` handles this. |
| **iOS Safari cannot receive web push** | Medium | Low | In-app notifications already work. Show an educational banner about adding to home screen for push support. |

### 28.3 Low Impact

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Supabase Edge Function cold start delays push** | Medium | Low | Notifications are async. A 500ms delay is unnoticeable. Warm function instances will handle subsequent pushes quickly. |
| **FCM token changes unexpectedly** | Low | Low | `onTokenRefresh` handler in `useFcmToken` upserts the new token. |
| **pg_net extension not available** | Low | Medium | Fall back to `fcm_queue` polling approach. |
| **Cost of FCM API calls at scale** | Low | Low | FCM is free for up to 20M messages/day per project. |

---

## 29. Recommended Implementation Phases

### Phase 1 — Foundation (Days 1-3)

| Task | Deliverable | Files |
|------|-------------|-------|
| Create Firebase project | Firebase project configured, service account generated | (Firebase Console) |
| Set up VAPID keys | Public/private key pair generated | (Firebase Console) |
| Write DB migrations | SQL files for `device_tokens`, queue, columns, prefs | 4 migration files |
| Apply migrations | Tables created in Supabase | `supabase db push` |
| Add env vars | `.env` updated with Firebase config | `.env` |
| Create Supabase Secrets | Service account, secret stored | `supabase secrets set` |

### Phase 2 — Edge Function (Days 4-6)

| Task | Deliverable | Files |
|------|-------------|-------|
| Scaffold Edge Function | `send-fcm/index.ts` with basic structure | `supabase/functions/send-fcm/index.ts` |
| Implement FCM API helper | OAuth token generation, message construction | `supabase/functions/send-fcm/utils/fcm.ts` |
| Implement retry logic | Exponential backoff | `supabase/functions/send-fcm/utils/retry.ts` |
| Implement preference checking | DB query for `notification_prefs` | `supabase/functions/send-fcm/utils/preferences.ts` |
| Deploy Edge Function | `supabase functions deploy send-fcm` | (deployed) |
| Connect DB trigger | Trigger calls Edge Function via pg_net or queue | Migration file with trigger |

### Phase 3 — Client Registration (Days 7-9)

| Task | Deliverable | Files |
|------|-------------|-------|
| Install Firebase SDK | `npm install firebase` | `package.json` |
| Create `FcmService` | Full service class | `src/services/FcmService.ts` |
| Create `DeviceTokenService` | Full service class | `src/services/DeviceTokenService.ts` |
| Create `useFcmToken` hook | Token lifecycle management | `src/hooks/useFcmToken.ts` |
| Create service worker | Static JS file | `public/firebase-messaging-sw.js` |
| Register SW in main.tsx | Service worker registration | `src/main.tsx` |
| Integrate with AuthContext | Token revoke on logout | `src/contexts/AuthContext.tsx` |
| Update services barrel | Exports | `src/services/index.ts` |

### Phase 4 — Foreground + Background (Days 10-12)

| Task | Deliverable | Files |
|------|-------------|-------|
| Create `useFcmForegroundMessage` | Foreground push → toast | `src/hooks/useFcmForegroundMessage.ts` |
| Add deduplication logic | Prevents duplicate toasts | `useFcmForegroundMessage.ts` |
| Implement background handlers | Push event + click event | `public/firebase-messaging-sw.js` |
| Test end-to-end | Full flow: insert → push → receive | (manual testing) |

### Phase 5 — Settings & Preferences (Days 13-14)

| Task | Deliverable | Files |
|------|-------------|-------|
| Add permission request UI to SettingsPage | Toggle + permission state | `src/pages/SettingsPage.tsx` |
| Add device management UI | List registered devices | `src/pages/SettingsPage.tsx` |
| Sync preferences to DB | `NotificationService.setPreferences()` update | `src/services/NotificationService.ts` + `SettingsPage.tsx` |
| Update types | `DeviceToken`, preference types | `src/types/notifications.ts` |

### Phase 6 — Hardening (Days 15-17)

| Task | Deliverable | Files |
|------|-------------|-------|
| FCM delivery monitoring | `fcm_delivery_log` table, Edge Function logging | Migration + function update |
| Token cleanup cron | Scheduled Edge Function for stale tokens | `supabase/functions/cleanup-tokens/index.ts` |
| Error alerting | Supabase monitoring setup | (Supabase Dashboard) |
| Load testing | Simulate concurrent notifications | (test script) |
| Documentation | Update README, architecture docs | `README.md` |

---

## Appendix A: Architecture Diagram (Text)

```
                    ┌───────────────────────────────────────┐
                    │          FIREBASE PROJECT              │
                    │  ┌─────────────────────────────────┐  │
                    │  │  FCM HTTP v1 API                │  │
                    │  │  POST /v1/projects/.../messages │  │
                    │  └──────────▲──────────────────────┘  │
                    │             │                          │
                    │  ┌──────────┴──────────────┐          │
                    │  │  Firebase Service        │          │
                    │  │  Account (OAuth 2.0)     │          │
                    │  └─────────────────────────┘          │
                    └───────────────────────────────────────┘
                                      │
                    ┌─────────────────┼────────────────
                    │                 │
                    ▼                 ▼
          ┌─────────────────┐  ┌──────────────────────────┐
          │  SUPABASE DB     │  │  SUPABASE EDGE FUNCTION  │
          │                  │  │                          │
          │  notifications───┼──┤  send-fcm                │
          │  │ INSERT trigger│  │  │                       │
          │  ▼               │  │  ├─ Query device_tokens  │
          │  fcm_queue       │  │  ├─ Check preferences    │
          │  (or pg_net) ────┼──┤  ├─ POST to FCM API     │
          │                  │  │  ├─ Update sent_via_fcm  │
          │  device_tokens   │  │  └─ Mark invalid tokens  │
          │                  │  └──────────────────────────┘
          │  profiles        │
          │  notification    │
          │  _prefs          │
          └─────────────────┘
                                      │
                    ┌─────────────────┼────────────────
                    │                 │
                    ▼                 ▼
          ┌─────────────────┐  ┌──────────────────────────┐
          │  CLIENT (WEB)    │  │  CLIENT (MOBILE)         │
          │                  │  │                          │
          │  React App       │  │  (future: Native App)    │
          │  ├─ Page         │  │                          │
          │  │  Notifications│  │                          │
          │  ├─ useUnreadCnt │  │                          │
          │  ├─ Realtime     │  │                          │
          │  │  sub          │  │                          │
          │  ├─ FCM onMessage│  │                          │
          │  └─ SW push      │  │                          │
          │     handlers     │  │                          │
          └─────────────────┘  └──────────────────────────┘
```

## Appendix B: FCM HTTP v1 Message Payload (Full)

```json
{
  "message": {
    "token": "fM-3...device_fcm_token...",
    "notification": {
      "title": "رسالة جديدة",
      "body": "لديك رسالة جديدة من أحمد"
    },
    "data": {
      "notification_id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "new_message",
      "title_ar": "رسالة جديدة",
      "body_ar": "لديك رسالة جديدة من أحمد",
      "link": "/chat/conv-123",
      "unread_count": "5"
    },
    "webpush": {
      "headers": {
        "TTL": "86400",
        "Urgency": "high"
      },
      "fcm_options": {
        "link": "/notifications"
      },
      "notification": {
        "icon": "/favicon.png",
        "badge": "/badge-icon.png",
        "vibrate": [200, 100, 200],
        "requireInteraction": false,
        "renotify": false,
        "tag": "550e8400-e29b-41d4-a716-446655440000"
      }
    },
    "android": {
      "ttl": "86400s",
      "notification": {
        "channel_id": "moktari_notifications",
        "priority": "high",
        "default_sound": true,
        "default_vibrate_timings": true
      }
    },
    "apns": {
      "headers": {
        "apns-priority": "10",
        "apns-expiration": "86400"
      },
      "payload": {
        "aps": {
          "alert": {
            "title": "رسالة جديدة",
            "body": "لديك رسالة جديدة من أحمد"
          },
          "badge": 5,
          "sound": "default",
          "mutable-content": 1,
          "category": "new_message"
        }
      }
    }
  }
}
```

---

*End of specification.*
