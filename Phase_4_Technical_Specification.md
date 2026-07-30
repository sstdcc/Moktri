# Phase 4 Technical Specification: Notification Read-Side Hooks & NotificationsPage Refactor

**Based on:** Phase 4 Architecture Analysis (verified and approved)  
**Date:** 2026-07-30  
**Pre-requisite:** Phase 3 commit `89de4c5` — all 35 write-site call sites migrated.

---

## 1. Scope

Phase 4 covers the **read-side integration** of the NotificationService. It creates React Query hooks for the 6 read/mutate methods (getNotifications, getUnreadCount, getNotification, markAsRead, markAllAsRead, delete), refactors the existing `useUnreadCount` hook to use the service, and refactors `NotificationsPage` to use the new hooks.

**In scope:**
- React Query hooks wrapping `getNotifications`, `getUnreadCount`, `getNotification`, `markAsRead`, `markAllAsRead`, `delete`
- Refactoring `src/hooks/useUnreadCount.ts` to call `NotificationService.getUnreadCount()` (preserving React Query + real-time + return type)
- Refactoring `src/pages/NotificationsPage.tsx` to use the new hooks

**Out of scope:**
- `create` / `createMany` hooks (already fire-and-forget from Phase 3)
- Notification preferences (`getPreferences` / `setPreferences`) — deferred
- `<NotificationPreferencesPanel>` component — deferred
- Changes to `NotificationService.ts`, `types/notifications.ts`, or the database schema
- Changes to existing `useUnreadCount` consumers (`AppSidebar`, `BottomNav`, `MainLayout`)
- Push notifications, Edge Functions, or any new infrastructure

---

## 2. Objectives

| ID | Objective |
|----|-----------|
| O1 | Create `useNotificationQueries.ts` — React Query hooks for `getNotifications`, `getUnreadCount`, `getNotification`. |
| O2 | Create `useNotificationMutations.ts` — React Query mutations for `markAsRead`, `markAllAsRead`, `delete`. |
| O3 | Refactor `useUnreadCount.ts` to call `NotificationService.getUnreadCount()` instead of inline `supabase.from('notifications')`. Preserve existing React Query setup, real-time channel, and `number` return type. |
| O4 | Refactor `NotificationsPage.tsx` to use the new hooks, removing all inline Supabase queries. |

---

## 3. Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useUnreadCount.ts` | Replace inline query function with `createNotificationService(supabase).getUnreadCount()`. |
| `src/pages/NotificationsPage.tsx` | Replace inline `supabase.from('notifications')` queries with hooks from `useNotificationQueries` and `useNotificationMutations`. |

---

## 4. Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useNotificationQueries.ts` | React Query hooks for read operations. |
| `src/hooks/useNotificationMutations.ts` | React Query mutations for write operations (mark read, delete). |

---

## 5. Public APIs

### 5.1 `useNotificationQueries.ts`

```typescript
import { createNotificationService } from '@/services';
import type { NotificationQueryParams, PaginatedResult, NotificationRecord } from '@/types/notifications';

/**
 * Returns a paginated list of notifications for the current user.
 * Uses useInfiniteQuery for cursor-free pagination via page/pageSize.
 * Cache key: ['notifications', { page, pageSize, filter, type }]
 */
function useNotifications(params?: NotificationQueryParams): {
  data: PaginatedResult<NotificationRecord> | undefined;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Returns a single notification by ID. Returns null if not found.
 * Cache key: ['notification', id]
 * Enabled only when id is a non-empty string.
 */
function useNotification(id: string): {
  data: NotificationRecord | undefined;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Returns the unread notification count for the current user.
 * Already exists in useUnreadCount.ts — this is the "raw" hook without real-time.
 * Cache key: ['unread-notifications-count', userId]
 * staleTime: 60s, gcTime: 30min.
 */
function useUnreadCountQuery(): {
  data: number;
  isLoading: boolean;
};
```

### 5.2 `useNotificationMutations.ts`

```typescript
/**
 * Marks a single notification as read.
 * On success: invalidates ['notifications'] and ['unread-notifications-count', ...] cache keys.
 */
function useMarkAsRead(): {
  mutate: (id: string) => void;
  mutateAsync: (id: string) => Promise<void>;
  isLoading: boolean;
};

/**
 * Marks all notifications as read for the current user.
 * On success: invalidates ['notifications'] and ['unread-notifications-count', ...] cache keys.
 */
function useMarkAllAsRead(): {
  mutate: () => void;
  mutateAsync: () => Promise<void>;
  isLoading: boolean;
};

/**
 * Deletes a single notification by ID.
 * On success: removes the item from the ['notifications'] cache and invalidates unread count.
 */
function useDeleteNotification(): {
  mutate: (id: string) => void;
  mutateAsync: (id: string) => Promise<void>;
  isLoading: boolean;
};
```

### 5.3 Refactored `useUnreadCount.ts`

```typescript
/**
 * Returns the unread notification count for the current user.
 * Uses React Query + Supabase Realtime for live updates.
 * Return type: number — identical to current API. No breaking changes.
 */
export const useUnreadCount = (): number;
```

**Changes from current:**
- Query function changes from `supabase.from('notifications').select(..., { count: 'exact', head: true })` to `createNotificationService(supabase).getUnreadCount()`
- Everything else preserved: `useQuery` setup, query key, `staleTime`, `gcTime`, real-time channel, return type.

---

## 6. Data Flow

### 6.1 Before Phase 4

```
useUnreadCount():
  supabase.from('notifications').select('*', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('is_read', false)
  → React Query cache → number

NotificationsPage:
  supabase.from('notifications').select('*').eq('user_id', user.id)
    .order('created_at', { ascending: false }).range(from, to)
  → useState<NotificationRecord[]>
  → markAsRead: supabase.from('notifications').update({ is_read: true }).eq('id', id)
  → markAllAsRead: supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id)
  → delete: supabase.from('notifications').delete().eq('id', id)
```

### 6.2 After Phase 4

```
useUnreadCount():
  createNotificationService(supabase).getUnreadCount()
  → React Query cache → number
  (real-time channel unchanged)

NotificationsPage:
  useNotifications({ page, pageSize }) → PaginatedResult
  useMarkAsRead().mutate(id) → optimistic cache update → Supabase
  useMarkAllAsRead().mutate() → optimistic cache update → Supabase
  useDeleteNotification().mutate(id) → optimistic cache update → Supabase
```

---

## 7. Step-by-Step Implementation Plan

### Step 1: Create `src/hooks/useNotificationQueries.ts`

**Actions:**
1. Import `createNotificationService` from `@/services` and types from `@/types/notifications`.
2. Create `useNotifications(params?)`:
   - Query key: `['notifications', params]`.
   - `queryFn`: calls `createNotificationService(supabase).getNotifications(params ?? {})`.
   - Return the full `PaginatedResult<NotificationRecord>`.
   - Stale time: 30s.
3. Create `useNotification(id)`:
   - Query key: `['notification', id]`.
   - `enabled`: `!!id`.
   - `queryFn`: calls `createNotificationService(supabase).getNotification(id)`.
   - Stale time: 60s.
4. Create `useUnreadCountQuery()`:
   - Query key: `['unread-notifications-count', user?.id ?? 'guest']`.
   - `enabled`: `!!user`.
   - `queryFn`: calls `createNotificationService(supabase).getUnreadCount()`.
   - `staleTime`: 60s, `gcTime`: 30min.
   - Returns `number` (default `0`).
5. Export all three functions.

### Step 2: Create `src/hooks/useNotificationMutations.ts`

**Actions:**
1. Import `createNotificationService` from `@/services` and `useQueryClient` from `@tanstack/react-query`.
2. Create `useMarkAsRead()`:
   - `mutationFn`: calls `createNotificationService(supabase).markAsRead(id)`.
   - `onSuccess`: invalidate `['notifications']` and `['unread-notifications-count']` query keys.
3. Create `useMarkAllAsRead()`:
   - `mutationFn`: calls `createNotificationService(supabase).markAllAsRead()`.
   - `onSuccess`: invalidate `['notifications']` and `['unread-notifications-count']` query keys.
4. Create `useDeleteNotification()`:
   - `mutationFn`: calls `createNotificationService(supabase).delete(id)`.
   - `onMutate`: optimistically remove the notification from the `['notifications']` cache.
   - `onError`: roll back the optimistic removal.
   - `onSettled`: invalidate `['unread-notifications-count']` query key.
5. Export all three functions.

### Step 3: Refactor `src/hooks/useUnreadCount.ts`

**Actions:**
1. Remove imports that are no longer needed (e.g., direct `supabase` import if only used for the query).
2. Replace the `queryFn` body:
   - **Before:** inline `supabase.from('notifications').select(...)` call.
   - **After:** `return createNotificationService(supabase).getUnreadCount();`.
3. Preserve everything else:
   - `useQuery` with same `queryKey`, `staleTime`, `gcTime`, `initialData`.
   - `useEffect` with real-time `supabase.channel(...)` subscription.
   - Return type `number`.
4. Verify no breaking changes by confirming TypeScript build passes.

### Step 4: Read and Analyze `src/pages/NotificationsPage.tsx`

**Actions:**
1. Read the full file to understand:
   - Current inline Supabase queries (select, count, update, delete).
   - Pagination state management.
   - Filtering logic (unread / all / by type).
   - UI rendering (list items, mark-read, mark-all-read, delete buttons).
2. Map each inline Supabase operation to the corresponding hook:
   - `supabase.from('notifications').select(...)` → `useNotifications(params)`.
   - `supabase.from('notifications').update({ is_read: true }).eq('id', id)` → `useMarkAsRead().mutate(id)`.
   - `supabase.from('notifications').update({ is_read: true }).eq('user_id', ...)` → `useMarkAllAsRead().mutate()`.
   - `supabase.from('notifications').delete().eq('id', id)` → `useDeleteNotification().mutate(id)`.

### Step 5: Refactor `src/pages/NotificationsPage.tsx`

**Actions:**
1. Add imports for `useNotifications`, `useMarkAsRead`, `useMarkAllAsRead`, `useDeleteNotification`.
2. Remove the direct `supabase` import if it is only used for notification operations.
3. Replace inline Supabase queries with hook calls.
4. Replace manual `useState` for loading/error/pagination with data from hooks.
5. Wire mutation `.mutate()` calls to the existing click handlers.
6. Ensure the same UI behavior (loading spinner, empty state, error toast, pagination controls).
7. Run build and fix any TypeScript errors.

### Step 6: Run Full Gate

**Actions:**
1. `npm run build` — verify zero errors.
2. `npx vitest run` — verify all 56 tests pass.
3. `npx eslint src` — verify zero new errors.
4. Manually verify `useUnreadCount()` still returns `number` and consumers render correctly.

---

## 8. Testing Plan

### 8.1 Unit Tests (New)

| File | Tests |
|------|-------|
| `useNotificationQueries.test.ts` | — `useNotifications` returns paginated data from mocked service<br>— `useNotifications` handles service error<br>— `useNotification` returns single record<br>— `useNotification` returns undefined for empty ID<br>— `useUnreadCountQuery` returns count from mocked service |
| `useNotificationMutations.test.ts` | — `useMarkAsRead` calls service with correct ID<br>— `useMarkAsRead` invalidates cache keys on success<br>— `useMarkAllAsRead` calls service<br>— `useDeleteNotification` removes item from cache optimistically<br>— `useDeleteNotification` rolls back on error |

### 8.2 Existing Test Preservation

All 56 existing `NotificationService.test.ts` tests must continue to pass. No changes to those tests are required.

### 8.3 Manual Test Checklist

1. Open NotificationsPage → list loads with pagination.
2. Click a notification → item dims, badge decrements.
3. Click "Mark all as read" → all items dim, badge goes to 0.
4. Delete a notification → item removed from list.
5. Open second tab → mark read in tab A → tab B badge updates.
6. Sidebar/bottom-nav badge matches NotificationsPage count.
7. Log out → notification UI hides.
8. Network error → error state shown, retry works.

---

## 9. Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC1 | `useUnreadCount()` returns `number` with identical API. All 3 consumers (`AppSidebar`, `BottomNav`, `MainLayout`) build without changes. | `npm run build` |
| AC2 | `useUnreadCount()` calls `createNotificationService(supabase).getUnreadCount()`, not inline Supabase. | Code review |
| AC3 | `useUnreadCount()` real-time subscription continues to work. | Manual cross-tab test |
| AC4 | `NotificationsPage` has zero inline `supabase.from('notifications')` calls. | Code review + grep |
| AC5 | `NotificationsPage` renders the same UI (loading, empty, error, paginated list). | Visual comparison |
| AC6 | "Mark as read" updates cache immediately and decrements badge. | Visual test |
| AC7 | "Mark all as read" updates all items and sets badge to 0. | Visual test |
| AC8 | Delete removes item from list and decrements badge. | Visual test |
| AC9 | `NotificationService.ts` and `types/notifications.ts` are unmodified. | `git diff` |
| AC10 | `npm run build` passes. | CI / local |
| AC11 | All 56 existing tests pass. | `npx vitest run` |
| AC12 | ESLint zero new errors. | `npx eslint src` |

---

## 10. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Tag current state: `git tag phase-4-start` before any changes. |
| 2 | Implement changes in order: hooks → useUnreadCount → NotificationsPage. Commit after each step. |
| 3 | If `useUnreadCount` breaks after refactor: `git checkout phase-4-start -- src/hooks/useUnreadCount.ts`. |
| 4 | If `NotificationsPage` breaks after refactor: `git checkout phase-4-start -- src/pages/NotificationsPage.tsx`. |
| 5 | If new hooks have issues: delete `src/hooks/useNotificationQueries.ts` and `src/hooks/useNotificationMutations.ts`. Restore original `NotificationsPage` with Step 4. |
| 6 | Full rollback: `git checkout phase-4-start` and delete the two new hook files. |
| 7 | The 17 Phase-3 files and all other source files are never touched — they remain safe regardless. |

---

*End of Phase 4 Technical Specification. No implementation code is included.*
