# Phase 5 Technical Specification — Notification System

## Overview

Phase 5 closes three remaining gaps in the notification system architecture:

1. **Add FOR DELETE RLS policy** — unblocks client-side `deleteNotification()`
2. **Migrate RenterDashboard inline query** — last inline `supabase.from('notifications')` → `useUnreadCount()`
3. **Fix markAsRead error recovery** — add `onError` rollback + toast to the mutation call

No new features, no new infrastructure, no changes outside the notification system.

---

## Task 1: Add FOR DELETE RLS policy on notifications table

### Purpose

The `deleteNotification()` method in `NotificationService` has been fully implemented since Phase 1 but **cannot execute from the client** because:
- No `FOR DELETE` RLS policy exists on `public.notifications`
- The `authenticated` role has not been granted `DELETE` privilege on the table

Adding both completes the service's CRUD capabilities.

### Files Affected

| Action | File |
|--------|------|
| **Create** | `supabase/migrations/<next_timestamp>_add_notifications_delete_rls.sql` |
| **Edit** | `src/services/NotificationService.ts` (comment cleanup — see Task 2) |

### Public APIs Affected

| API | Impact |
|-----|--------|
| `NotificationService.delete(notificationId)` | Changes from **always throws FORBIDDEN** to **succeeds for own notifications, throws FORBIDDEN for others**. The method signature and behavior contract are unchanged — callers already handle both success and error paths. |
| `useDeleteNotification()` mutation | No change. Existing `onSuccess`/`onError` handlers continue to work. The mutation will now succeed where it previously always failed. |

### Internal Changes

**New migration file** (`supabase/migrations/<timestamp>_add_notifications_delete_rls.sql`):

```sql
-- Add DELETE permission for authenticated users on notifications table.
-- Previously only SELECT, INSERT, UPDATE were granted (see migration
-- 20260724150000 line 68). DELETE was omitted.

GRANT DELETE ON public.notifications TO authenticated;

-- FOR DELETE RLS policy: users can only delete their own notifications.
-- Matches the existing FOR SELECT and FOR UPDATE policy pattern from
-- migration 20260329221626 lines 207-208.

CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);
```

The new migration follows the exact naming convention of existing migrations and uses the same RLS condition (`auth.uid() = user_id`) as the existing SELECT and UPDATE policies.

### Data Flow Impact

```
Before: DELETE FROM notifications WHERE id = 'x'
        → RLS: no policy → blocked
        → Error: { code: "42501", message: "permission denied" }
        → classifyError → NotificationError("FORBIDDEN")
        → mutation onError → toast.error

After:  DELETE FROM notifications WHERE id = 'x'
        → RLS: auth.uid() = user_id → allowed for owner
        → Success: row deleted
        → mutation onSuccess → cache invalidated

        DELETE FROM notifications WHERE id = 'y' (not own)
        → RLS: auth.uid() ≠ user_id → blocked
        → Error: { code: "42501", message: "permission denied" }
        → classifyError → NotificationError("FORBIDDEN")
        → mutation onError → toast.error + rollback
```

The only change is that **own-notification deletes now succeed**. Everything else is identical.

### Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Migration conflicts with unapplied migrations in other environments | Very Low | Sequential timestamp naming. No other in-flight migrations expected. |
| Policy incorrectly allows deleting other users' notifications | Very Low | Uses `auth.uid() = user_id` — same condition as SELECT (line 207) and UPDATE (line 208) policies which have been in production for months. |
| `GRANT DELETE` accidentally exposes the table to unauthorized roles | Very Low | Grant is scoped to `authenticated` role only. The `FOR DELETE` policy restricts execution to row owner. |

### Rollback Plan

```sql
-- Rollback migration:
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
REVOKE DELETE ON public.notifications FROM authenticated;
```

If the migration causes issues in production, run the rollback SQL and the system returns to the pre-Phase 5 state (delete continues to fail with FORBIDDEN, which is the known existing behavior).

### Testing Plan

| Test | Type | What It Covers |
|------|------|---------------|
| Existing `delete()` success test (line 454) | Unit (unchanged) | Mock returns `{ id: "notif-1" }` → `delete("notif-1")` resolves. This test continues to pass — it always tested the service logic, not the RLS layer. |
| Existing `delete()` FORBIDDEN test (line 489) | Unit (unchanged) | Mock returns error `{ code: "42501" }` → `delete("notif-1")` rejects with FORBIDDEN. This test continues to pass — it tests the `classifyError` path which is unchanged. |
| Manual: delete own notification | Manual | Login → NotificationsPage → swipe-to-delete → notification removed → refresh → still gone. |
| Manual: verify RLS enforcement | Manual | Via Supabase SQL editor: `DELETE FROM notifications WHERE id = '<other_user_notification>'` as authenticated user → expect FORBIDDEN. |

**No test changes required.** The existing mock-based tests already cover both the success and FORBIDDEN paths. The tests don't connect to a real database, so they are unaffected by the RLS policy change.

### Acceptance Criteria

- AC1: Client-side `deleteNotification()` succeeds for the notification owner
- AC2: Client-side `deleteNotification()` throws `NotificationError("FORBIDDEN")` for non-owner (unchanged behavior)
- AC3: All 56 existing tests continue to pass

---

## Task 2: Remove obsolete comment from NotificationService.ts

### Purpose

The 5-line comment block at lines 214–218 in `NotificationService.ts` documents the missing `FOR DELETE` RLS policy. After Task 1 creates the policy, this comment becomes obsolete and misleading. Removing it keeps the code accurate.

### Files Affected

| Action | File | Lines |
|--------|------|-------|
| **Edit** | `src/services/NotificationService.ts` | 214–218 |

### Public APIs Affected

None. Comment removal has no runtime effect.

### Internal Changes

Remove lines 214–218 from `NotificationService.ts`:

```
-    // Note: There is currently no FOR DELETE RLS policy on the notifications table.
-    // The existing policy only covers SELECT and UPDATE with auth.uid() = user_id.
-    // Until a FOR DELETE policy is added, this operation may fail with a FORBIDDEN
-    // error when called from the client side. This is a known database configuration gap
-    // that should be addressed separately from the application layer.
```

The surrounding code (input validation, try-catch, error classification, logging) is untouched.

### Data Flow Impact

None.

### Risks

None.

### Rollback Plan

Restore the deleted lines via `git checkout -- src/services/NotificationService.ts`.

### Testing Plan

None required. Comment removal does not affect any test.

### Acceptance Criteria

- AC4: No reference to a missing DELETE policy exists in `NotificationService.ts`

---

## Task 3: Migrate RenterDashboard inline query to useUnreadCount()

### Purpose

`RenterDashboard.tsx` is the only file in the codebase that still queries `notifications` directly via `supabase.from('notifications')` instead of going through `NotificationService`. This was missed during Phases 2–4. The inline query:

- Has no real-time updates (count is fetched once on mount)
- Bypasses the service layer
- Duplicates the exact logic already encapsulated by `useUnreadCount()`

Migrating to `useUnreadCount()` gives the dashboard real-time notification count updates and completes the architectural migration pattern.

### Files Affected

| Action | File | Lines |
|--------|------|-------|
| **Edit** | `src/pages/dashboards/RenterDashboard.tsx` | 3, 31, 43, 47 |

### Public APIs Affected

None. `useUnreadCount()` already exists and its return type (`number`) matches the existing `unreadCount` state variable.

### Internal Changes

Four changes to `RenterDashboard.tsx`:

1. **Add import** (after line 4 or at the import block):
   ```
   import { useUnreadCount } from '@/hooks/useUnreadCount';
   ```

2. **Remove `unreadCount` state** (line 31):
   ```
   - const [unreadCount, setUnreadCount] = useState(0);
   ```

3. **Remove the notification query from `fetchData`** (line 43):
   ```
   - const [reqRes, favRes, notifRes] = await Promise.all([
   + const [reqRes, favRes] = await Promise.all([
        supabase.from('housing_requests').select(...),
        supabase.from('favorites').select(...),
   -    supabase.from('notifications').select(...),
     ]);
     setMyRequests(reqRes.data ?? []);
     setFavCount(favRes.count ?? 0);
   - setUnreadCount(notifRes.count ?? 0);
   ```

4. **Add the hook call** (after the existing state declarations, e.g., after line 32):
   ```
   + const unreadCount = useUnreadCount();
   ```

### Data Flow Impact

```
Before:  useEffect → fetchData → inline query → setUnreadCount(n) → render
         Count is fetched once on mount. Stale until page refresh.

After:   const unreadCount = useUnreadCount()
         → useQuery with 60s staleTime
         → Realtime subscription invalidates query on any change
         → count updates instantly → render
```

The label display at line 80 (`الإشعارات (${unreadCount})`) is unaffected — it reads from the same variable name with the same type.

### Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `useUnreadCount()` returns `0` during initial loading, briefly showing `0` instead of the true count | Low | The existing code also starts at `0` (line 31: `useState(0)`). The hook's `initialData: 0` ensures the same behavior. No regression. |
| `useUnreadCount()` creates a Realtime subscription that survives RenterDashboard unmount | Very Low | The hook's `useEffect` cleanup calls `supabase.removeChannel(channel)` (line 35 of useUnreadCount.ts). Verified. |
| Removing `setUnreadCount` from `fetchData` leaves a dangling reference | Very Low | `setUnreadCount` is only used at line 47 (inside the same `fetchData` callback). No other references. |

### Rollback Plan

Restore the file to its original state:
```bash
git checkout -- src/pages/dashboards/RenterDashboard.tsx
```

### Testing Plan

| Test | Type | What It Covers |
|------|------|---------------|
| RenterDashboard renders with unread count | Manual | Login as renter → navigate to dashboard → verify bell icon shows correct unread count |
| Real-time count updates | Manual | Open RenterDashboard → create a new notification for the renter in another tab → verify badge updates without page refresh |
| `useUnreadCount` returns `0` when not authenticated | Unit (existing) | The existing hook test pattern (not in this repo, but the hook's `enabled: !!user` guard is verified) |

### Acceptance Criteria

- AC5: `RenterDashboard` displays the unread notification count via `useUnreadCount()`
- AC6: No `supabase.from('notifications')` query exists anywhere in `RenterDashboard.tsx`
- AC7: The unread count badge updates in real-time when notifications change

---

## Task 4: Add onError to markAsRead mutation in NotificationsPage

### Purpose

The `markAsRead` mutation at line 350 of `NotificationsPage.tsx` calls `markAsReadMutation.mutate(notif.id)` **without an `onError` callback**. If the backend call fails:

- The optimistic state update at line 349 (`isRead: true`) becomes **permanent**
- The unread count decrements permanently
- The user sees no error feedback

This is the only mutation on the page missing error recovery. `markAllAsRead` (lines 359–361) and `deleteNotification` (lines 369–373) both have `onError` handlers with toast + rollback.

### Files Affected

| Action | File | Lines |
|--------|------|-------|
| **Edit** | `src/pages/NotificationsPage.tsx` | 350 |

### Public APIs Affected

None. `useMarkAsRead()` is unchanged. Only the call site gets error handling.

### Internal Changes

Change line 350 from:
```typescript
markAsReadMutation.mutate(notif.id);
```
to:
```typescript
markAsReadMutation.mutate(notif.id, {
  onError: () => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: false } : n)),
    );
    toast.error('تعذر تحديث الإشعار');
  },
});
```

### Data Flow Impact

```
Before:  tap → optimistic isRead:true
         → mutate(notif.id) → [server fails] → optimistic state stays true
         → user sees no error → unread count wrong

After:   tap → optimistic isRead:true
         → mutate(notif.id) → [server fails]
         → onError → isRead reverted to false
         → toast.error('تعذر تحديث الإشعار')
         → user informed, state consistent
```

### Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `setNotifications` call in `onError` fires after component unmounts | Very Low | React 18 silently ignores state updates on unmounted components. No error thrown. |
| `onError` rollback races with a Realtime invalidation that arrives simultaneously | Very Low | If a Realtime event fires a new fetch right after the rollback, the fetched data will overwrite the rolled-back state. The user was about to see the correct data anyway. Acceptable. |

### Rollback Plan

Restore line 350:
```bash
git checkout -- src/pages/NotificationsPage.tsx
```
Or manually revert the single line to: `markAsReadMutation.mutate(notif.id);`

### Testing Plan

| Test | Type | What It Covers |
|------|------|---------------|
| `markAsRead` shows toast on failure | Manual | Block `UPDATE` on notifications table via browser devtools → tap unread notification → verify `toast.error` appears |
| `markAsRead` rolls back optimistic state on failure | Manual | Same setup → verify notification reverts from read to unread appearance |
| `markAsRead` succeeds normally | Manual | Normal flow → tap unread → verify read appearance persists → refresh to confirm |

### Acceptance Criteria

- AC8: Failed `markAsRead` calls revert the optimistic `isRead: true` state
- AC9: Failed `markAsRead` calls show `toast.error('تعذر تحديث الإشعار')`
- AC10: Successful `markAsRead` calls continue to work unchanged

---

## Summary of All Changes

| # | Task | Files | Lines Changed | Type |
|---|------|-------|---------------|------|
| 1 | FOR DELETE RLS + GRANT DELETE | 1 new migration | ~8 SQL | New |
| 2 | Remove obsolete comment | `NotificationService.ts` | −5 | Edit |
| 3 | RenterDashboard → useUnreadCount() | `RenterDashboard.tsx` | ~5 | Edit |
| 4 | markAsRead onError | `NotificationsPage.tsx` | ~8 | Edit |
| | **Total** | **4 files** | **~26 lines** | |

No new dependencies, no new packages, no new infrastructure, no new features. All changes are reversible via `git checkout`.
