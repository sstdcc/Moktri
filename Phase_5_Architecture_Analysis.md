# Phase 5 Architecture Analysis — Notification System

## 1. Objectives of Phase 5

1. **Unblock client-side notification deletion** — Add the missing `FOR DELETE` RLS policy on the `notifications` table. The `deleteNotification()` method in `NotificationService` has been fully implemented since Phase 1 but is blocked because no DELETE policy exists. This is the single remaining architecture gap in the service's CRUD capabilities.

2. **Eliminate the last inline notification query** — Migrate `RenterDashboard.tsx:43` from `supabase.from('notifications').select(...)` to the existing `useUnreadCount()` hook. Every other inline notification query was migrated in Phases 2–4. This is the last one, and its migration completes the architectural pattern: all notification data access goes through `NotificationService`.

3. **Fix missing error recovery in markAsRead** — The `markAsRead` mutation in `NotificationsPage.tsx:350` has no `onError` handler. If the backend call fails, the optimistic state update (`isRead: true`) is never rolled back and the user sees no error. This is a small notification-specific bug fix: add `onError` with toast feedback plus state rollback.

## 2. Remaining Notification-Related Work

Phase 5 addresses items marked **«PHASE 5»**. All others are deferred.

| # | Gap | Severity | Disposition | Why |
|---|-----|----------|-------------|-----|
| **1** | **No `FOR DELETE` RLS policy — `deleteNotification()` impossible from client** | **Blocking** | **«PHASE 5»** | Completes the service's CRUD capabilities. The method exists, is tested, but cannot work from the client. Pure architecture gap. |
| **2** | **`RenterDashboard.tsx:43` — last inline `supabase.from('notifications')` query** | **Medium** | **«PHASE 5»** | Completes the migration pattern established in Phases 2–4. One file, ~5 lines changed. |
| **3** | **`markAsRead` mutation in `NotificationsPage.tsx:350` — no `onError`, optimistic update is permanent** | **Medium** | **«PHASE 5»** | Small bug fix. Optimistic state becomes permanent if the server call fails. One file, ~3 lines changed. |
| 4 | `.catch(console.error)` at 28/31 create call sites — errors silently swallowed | High | Deferred | Affects 31 files across the entire app. Requires systematic cross-project refactoring. |
| 5 | No `onError` handler in `markAllAsRead` mutation | Low | Deferred | Already has onError at the call site (NotificationsPage.tsx:359-361). |
| 6 | No `onError` handler in `deleteNotification` mutation | Low | Deferred | Already has onError at the call site (NotificationsPage.tsx:369-373). |
| 7 | No Preferences UI — `getPreferences`/`setPreferences` unreachable | Medium | Deferred | New feature. Requires new UI component. Defers to future phase. |
| 8 | 5 `console.debug` statements reference a `LoggerService` that does not exist | Low | Deferred | Cross-cutting concern. Requires LoggerService architecture. |
| 9 | No explicit `user_id` filter in 5 service methods — relies only on RLS | Low | Deferred | Intentional design pattern. Changing it requires auditing all 10 methods. |
| 10 | `getUnreadCount` returns `0` on any error | Low | Deferred | Changing return type affects 3 consuming components. |
| 11 | NotificationsPage real-time channel uses fixed name | Low | Deferred | Single-instance SPA assumption is safe. |
| 12 | No automated cleanup of old notifications | Low | Deferred | Requires scheduled job infrastructure. |
| 13 | Preferences stored only in localStorage | Low | Deferred | Requires new DB table + sync strategy. |

## 3. Files Requiring Modification

### Database (new migration)

| Action | File | Change |
|--------|------|--------|
| Create | `supabase/migrations/<timestamp>_add_notifications_delete_rls.sql` | Grant `DELETE` to `authenticated` role + add `FOR DELETE` RLS policy (`auth.uid() = user_id`) |

### Service Layer

| Action | File | Change | Lines |
|--------|------|--------|-------|
| Edit | `src/services/NotificationService.ts` | Remove the 5-line comment block documenting the missing DELETE policy (obsolete after migration) | 214–218 |

### Pages / Components

| Action | File | Change | Lines |
|--------|------|--------|-------|
| Edit | `src/pages/dashboards/RenterDashboard.tsx` | Remove inline count query (line 43) and `setUnreadCount` state (line 31); import `useUnreadCount`; use returned value in the quickLinks array | ~5 lines changed |
| Edit | `src/pages/NotificationsPage.tsx` | Add `onError` callback to `markAsReadMutation.mutate(notif.id)` with `toast.error` + revert optimistic state | ~3 lines added at line 350 |

### No changes needed

| Reason | Files |
|--------|-------|
| Hook already exists with correct API | `src/hooks/useUnreadCount.ts` — no change |
| Hook already exists with correct API | `src/hooks/useNotificationMutations.ts` — no change |
| Hook already exists | `src/hooks/useNotificationQueries.ts` — no change |
| Types are complete | `src/types/notifications.ts` — no change |
| Barrel export covers everything | `src/services/index.ts` — no change |
| Tests already cover delete scenarios | `src/services/__tests__/NotificationService.test.ts` — no change |
| Test fixtures are adequate | `src/services/__tests__/fixtures/notifications.fixtures.ts` — no change |

## 4. Current Architecture (Phase 5 Scope)

```
┌──────────────────────────────────────────────────────────┐
│                     UI Layer                              │
│  ┌─────────────────┐  ┌────────────────────────────────┐ │
│  │ Notifications    │  │ RenterDashboard                │ │
│  │   Page           │  │                                │ │
│  │ ✅ markAsRead    │  │ ❌ inline supabase query L43   │ │
│  │ ❌ no error      │  │ ❌ no real-time updates        │ │
│  │   recovery on    │  │ ❌ useState(unreadCount) L31   │ │
│  │   mutation fail  │  └────────────────────────────────┘ │
│  └──────┬───────────┘                                     │
│         │                                                  │
│         ▼                                                  │
│  ┌──────────────────────────────────────┐                 │
│  │         NotificationService          │                 │
│  │  ✅ create / createMany / markAsRead  │                 │
│  │  ✅ markAllAsRead                     │                 │
│  │  ✅ getNotifications / getUnreadCount  │                 │
│  │  ⚠️ delete() — implemented but        │                 │
│  │    BLOCKED by missing DELETE RLS      │                 │
│  │  ❌ Comment at L214-218 documents gap │                 │
│  └──────────────┬───────────────────────┘                 │
│                 │                                         │
├─────────────────┼─────────────────────────────────────────┤
│                 ▼                                         │
│  ┌──────────────────────────────────────┐                │
│  │        PostgreSQL Database           │                │
│  │  notifications table                 │                │
│  │  ✅ RLS: SELECT  (auth.uid() = uid)  │                │
│  │  ✅ RLS: UPDATE  (auth.uid() = uid)  │                │
│  │  ❌ RLS: DELETE  (does not exist)    │                │
│  │  ❌ GRANT DELETE to authenticated     │                │
│  └──────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────┘

Key gaps in Phase 5 scope:
[1] No FOR DELETE RLS policy → deleteNotification() always fails
[2] RenterDashboard bypasses service layer with inline query
[3] markAsRead mutation can silently corrupt state on failure
```

## 5. Proposed Architecture (After Phase 5)

```
┌──────────────────────────────────────────────────────────┐
│                     UI Layer                              │
│  ┌─────────────────┐  ┌────────────────────────────────┐ │
│  │ Notifications    │  │ RenterDashboard                │ │
│  │   Page           │  │                                │ │
│  │ ✅ markAsRead    │  │ ✅ useUnreadCount() imported   │ │
│  │ ✅ onError →     │  │    and used                    │ │
│  │   toast +        │  │ ✅ real-time updates via       │ │
│  │   state rollback │  │    existing Realtime channel   │ │
│  │                  │  │ ✅ no inline supabase query    │ │
│  └──────┬───────────┘  └────────────────────────────────┘ │
│         │                                                  │
│         ▼                                                  │
│  ┌──────────────────────────────────────┐                 │
│  │         NotificationService          │                 │
│  │  ✅ create / createMany / markAsRead  │                 │
│  │  ✅ markAllAsRead / delete            │                 │
│  │  ✅ getNotifications / getUnreadCount  │                 │
│  │  ✅ delete() now works (RLS added)    │                 │
│  │  ✅ Obsolete comment removed          │                 │
│  └──────────────┬───────────────────────┘                 │
│                 │                                         │
├─────────────────┼─────────────────────────────────────────┤
│                 ▼                                         │
│  ┌──────────────────────────────────────┐                │
│  │        PostgreSQL Database           │                │
│  │  notifications table                 │                │
│  │  ✅ RLS: SELECT  (auth.uid() = uid)  │                │
│  │  ✅ RLS: UPDATE  (auth.uid() = uid)  │                │
│  │  ✅ RLS: DELETE  (auth.uid() = uid)  │ ▲ NEW          │
│  │  ✅ GRANT DELETE to authenticated     │ ▲ NEW          │
│  └──────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────┘

All three gaps closed:
[1] FOR DELETE RLS policy added → deleteNotification() works
[2] RenterDashboard uses useUnreadCount() → no inline queries
[3] markAsRead mutation has onError → toast + rollback on failure
```

## 6. Data Flow

### Deletion (currently broken → fixed)

```
User taps delete → optimistic UI removal
                → mutate(notif.id)
                → createNotificationService(supabase).delete(id)
                → DELETE FROM notifications
                  WHERE id = ? AND auth.uid() = user_id    [RLS enforced]
                → onSuccess: invalidate cache
                → onError: rollback + toast.error
```

Before Phase 5: step `DELETE ...` is rejected by RLS → `FORBIDDEN` error → error caught by `classifyError` → `NotificationError` thrown → mutation fails → user sees generic error. The `onError` handler in `NotificationsPage` does rollback the list + show `toast.error`, so the UI experience is acceptable, but the **server operation always fails**. After Phase 5: the server operation succeeds, so the user's intent is fulfilled.

### RenterDashboard count (currently stale → live)

```
Before:  useEffect → inline query → useState(0) → render
         No real-time updates. Count is only accurate at page load.

After:   const unreadCount = useUnreadCount()
         → useQuery with Realtime subscription (in useUnreadCount.ts)
         → count updates instantly when notifications change
         → no local state, no inline query
```

### markAsRead error (currently silent → user-visible)

```
Before:  User taps notification → optimistic isRead:true
         → mutate(notif.id) → [server fails]
         → optimistic update is PERMANENT → unread count wrong
         → no toast, no error indicator → user unaware

After:   User taps notification → optimistic isRead:true
         → mutate(notif.id) → [server fails]
         → onError fires → isRead reverted to false
         → toast.error('تعذر تحديث الإشعار') → user informed
```

## 7. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DELETE RLS policy conflicts with existing INSERT policies | Very Low | High | New policy uses exact same `auth.uid() = user_id` pattern as existing SELECT/UPDATE policies. No interaction with INSERT policies (they use different conditions). |
| DELETE RLS policy accidentally allows deleting other users' notifications | Very Low | High | Policy uses `USING (auth.uid() = user_id)`. This is the same clause used by the existing SELECT and UPDATE policies which have been in production since migration 20260329221626. Proven pattern. |
| RenterDashboard refactor accidentally breaks the quickLinks icon rendering | Low | Medium | `unreadCount` return type is `number` (unchanged). The existing variable has the same name. Only the source changes: `useState` → `useUnreadCount()`. |
| `useUnreadCount()` returns `0` during loading (before first fetch) | Low | Low | This is the same behavior as the current code (initial state is `0`). No regression. |
| markAsRead onError rollback races with a subsequent Realtime invalidation | Very Low | Low | The rollback sets local state directly. If a Realtime event arrives immediately after, it will overwrite. Race window is <100ms. Acceptable. |

## 8. Edge Cases

| Edge Case | How It's Handled |
|-----------|-----------------|
| User deletes a notification that was already deleted | `deleteNotification` throws `NOT_FOUND` → `onError` in NotificationsPage rolls back optimistic removal → user sees toast |
| User deletes while offline | Mutation fails → `onError` restores notification to list and shows error toast |
| RenterDashboard mounts with no authenticated user | `useUnreadCount()` returns `0` when `!user` (guarded by `enabled: !!user` in the hook) — same behavior as current `useState(0)` initial value |
| RenterDashboard unmounts while useUnreadCount subscription is active | The hook's `useEffect` cleanup calls `supabase.removeChannel(channel)` — no leak |
| markAsRead fails after user navigated to the linked page | The `onError` callback fires but the component may be unmounted. React Query handles this gracefully — calling `setState` on unmounted component is a no-op in React 18+ with strict mode, and React Query's error callbacks don't throw. |
| Rapid consecutive markAsRead calls | Each call is a separate mutation. React Query queues them. Optimistic updates are applied immediately for each call, so the UI feels responsive even if the server processes them sequentially. |

## 9. Testing Strategy

### Existing Tests (no changes needed, all continue to pass)

| Test File | Tests | Relevance |
|-----------|-------|-----------|
| `src/services/__tests__/NotificationService.test.ts` | 55 tests | Already covers `delete()` success, `delete()` with `FORBIDDEN`, `delete()` with `NOT_FOUND`. The `FORBIDDEN` test currently expects the error (blocked by RLS). After Phase 5, the mock can be updated to return success instead. |
| `src/test/example.test.ts` | 1 test | Unrelated. |

### New / Updated Tests

| Test | What It Covers | Type |
|------|---------------|------|
| `delete()` with success mock | After FOR DELETE RLS is added, the existing mock-based test already passes. No new test needed — the test expects `maybeSingle` to return `{ id: 'notif-1' }`, which is what the real RLS policy will allow. | Existing (unchanged) |
| `delete()` with FORBIDDEN mock | Tests that the service still throws `FORBIDDEN` correctly for non-owning users. The existing test already covers this. | Existing (unchanged) |

### Manual Verification

| Scenario | Steps | Expected Outcome |
|----------|-------|------------------|
| Delete own notification | Login → Open NotificationsPage → Swipe-to-delete a notification | Notification removed from list. Badge count decrements. Page refresh confirms deletion persists. |
| Delete notification while offline | Disconnect network → Delete notification → Reconnect | Notification reappears with error toast while offline. After reconnect, delete succeeds. |
| RenterDashboard count updates | Login as renter → Open RenterDashboard → Have admin create a notification for this user | The bell icon badge on RenterDashboard updates without page refresh. |
| markAsRead error recovery | Block `UPDATE` on notifications table via browser dev tools → Tap unread notification | Optimistic checkmark appears briefly, then reverts. `toast.error` appears. |

## 10. Acceptance Criteria

| ID | Criterion | Verification Method |
|----|-----------|-------------------|
| AC1 | Users can delete their own notifications from the NotificationsPage without receiving a `FORBIDDEN` error | Swipe-to-delete removes the notification. Refresh confirms deletion persisted in the database. |
| AC2 | Users cannot delete other users' notifications (RLS enforcement) | Attempt to delete via `supabase.from('notifications').delete()` for another user's notification — returns `FORBIDDEN`. |
| AC3 | `RenterDashboard` shows real-time unread notification count via `useUnreadCount()` | Create a notification for the renter → badge updates without page refresh. |
| AC4 | `RenterDashboard` has zero direct `supabase.from('notifications')` calls | Grep confirms no remaining inline queries. |
| AC5 | `markAsRead` mutation shows `toast.error` on failure and rolls back optimistic state | Block `UPDATE` on notifications table → tap unread → notification reverts to unread state + toast appears. |
| AC6 | Build has zero errors | `npm run build` exits with code 0. |
| AC7 | All existing tests pass | `vitest run` reports 56/56 passed. |

## 11. NotificationService Changes

| Change | Type | Lines | Rationale |
|--------|------|-------|-----------|
| Remove the "no DELETE policy" comment block | Cleanup | 214–218 | The comment documents a gap that Phase 5 closes. Keeping it would be misleading. |
| No code changes to any method | None | — | All 10 methods are correct. `deleteNotification()` already has proper validation, error classification, and logging. The only thing wrong was the database — not the service code. |

## 12. Database Changes Required

**Yes — one new migration.**

```sql
-- 1. Grant DELETE permission to the authenticated role
GRANT DELETE ON public.notifications TO authenticated;

-- 2. Add FOR DELETE RLS policy (identical pattern to existing SELECT/UPDATE policies)
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);
```

This is the **only database change**. It follows the exact same RLS pattern as the existing policies in migration `20260329221626`:
- `"Users can read own notifications"` → `FOR SELECT USING (auth.uid() = user_id)`
- `"Users can update own notifications"` → `FOR UPDATE USING (auth.uid() = user_id)`
- **New:** `"Users can delete own notifications"` → `FOR DELETE USING (auth.uid() = user_id)`

The `GRANT DELETE` is also required because migration `20260724150000` granted `SELECT, INSERT, UPDATE` but omitted `DELETE`.

## 13. New Infrastructure Required

**None.** No new packages, services, or external dependencies. Realtime is already enabled on the `notifications` table (migration `20260330162225`). The `useUnreadCount()` hook's Realtime channel is already established.

## 14. Scope

### In Scope (Phase 5)

| # | Task | Files Touched | Lines Changed | Why It Belongs |
|---|------|---------------|---------------|----------------|
| **1** | Add `FOR DELETE` RLS policy + `GRANT DELETE` | 1 new migration + 1 service file (comment cleanup) | ~10 SQL + ~5 removed | **Completes the service's CRUD.** The `deleteNotification()` method has existed since Phase 1 but is blocked. This is the single remaining architecture gap in the service's database permissions. |
| **2** | Migrate RenterDashboard inline query to `useUnreadCount()` | 1 file | ~5 | **Completes the migration pattern.** Phases 2–4 migrated every other inline notification query. RenterDashboard is the last outlier. Using the existing hook gives it real-time updates and eliminates direct database access. |
| **3** | Add `onError` to `markAsRead` mutation in NotificationsPage | 1 file | ~3 | **Bug fix.** The optimistic update becomes permanent if the server call fails. The `markAllAsRead` and `deleteNotification` mutations already have error handling — `markAsRead` was missed during Phase 4. |

### Total: 2–3 operational files, ~18 lines changed total.

### Out of Scope

| Item | Rationale |
|------|-----------|
| Replace `.catch(console.error)` at 28 create call sites | Cross-project refactoring affecting 31 files. Should be its own dedicated phase. |
| Notification Preferences UI | New product feature. Requires new UI component, routing, and user interaction. Defers to future phase. |
| LoggerService integration | Cross-cutting concern. Requires designing and implementing a logging service used by the entire app. |
| Add explicit `user_id` filters to service methods | Changes the intentional RLS-only design. Would require auditing all 10 methods and all callers. |
| Change `getUnreadCount` error behavior (return 0) | Would require changing the hook's return type and updating 3 consuming components. |
| NotificationsPage real-time channel naming | Single-instance SPA assumption is safe. Low severity. |
| Automated notification cleanup | Requires scheduled job infrastructure. Not a notification-system architecture concern. |
| Database-backed preferences | Requires new table, sync strategy, migration. New feature. |
| Preference checking during notification creation | Architectural change that depends on Preferences UI existing first. |

## 15. Summary

Phase 5 closes the three remaining gaps in the existing notification architecture without introducing any new features:

| Gap | Gap Since | Fix | Lines |
|-----|-----------|-----|-------|
| `deleteNotification()` blocked by missing RLS | Phase 1 (service creation) | 1 SQL migration + comment cleanup | ~15 |
| RenterDashboard last inline query | Phase 2 (before any migration) | Replace inline query with `useUnreadCount()` | ~5 |
| `markAsRead` no error recovery | Phase 4 (hook creation) | Add `onError` to mutation call | ~3 |

**Total: ~18 lines changed across 3 files plus 1 new migration.** No new features, no new components, no new infrastructure. The notification system reaches full architectural completion.
