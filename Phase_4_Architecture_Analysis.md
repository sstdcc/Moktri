# Phase 4 Architecture Analysis: Notification System Client Integration

**Author:** OpenCode AI  
**Date:** 2026-07-30  
**Status:** Draft for Review  
**Phase 3 Completed:** All 35 inline `supabase.from('notifications').insert()` call sites migrated to centralized `createNotificationService(supabase).create()` / `.createMany()` across 17 files.

---

## 1. Phase 4 Objectives

Phase 4 focuses on the **client-side read-side integration** that was deferred from Phases 1–3. The NotificationService now has 10 well-tested methods, but the **read-side** (query) methods (`getNotifications`, `getUnreadCount`, `getNotification`, `getPreferences`, `setPreferences`) are not yet used by any component. Components still call `supabase.from('notifications')` directly or use the raw `supabase` client instead of going through the service layer.

| Objective | Description |
|-----------|-------------|
| **O1** | Create React Query hooks wrapping the 5 read-side NotificationService methods (`getNotifications`, `getUnreadCount`, `getNotification`, `getPreferences`, `setPreferences`). The write-side methods (`create`, `createMany`) were handled in Phase 3 and must remain unchanged. |
| **O2** | Refactor `useUnreadCount` to use `NotificationService.getUnreadCount()` instead of inline `supabase.from('notifications')` query. The hook already uses React Query + real-time subscription — only the query function needs to change. |
| **O3** | Refactor `NotificationsPage` to use `NotificationService.getNotifications()` via the new hooks, replacing inline `supabase.from('notifications')` queries. |
| **O4** | Add a lightweight `<NotificationPreferencesPanel>` component for a notification settings UI (stored in localStorage via `NotificationService.setPreferences()`). |

**Non-goals:**
- No changes to `NotificationService.ts`, `types/notifications.ts`, or the DB schema.
- No new DB tables, columns, or RPCs.
- No modification of the 17 Phase-3-migrated files.
- No push notification infrastructure (Edge Functions, FCM, etc.).
- No changes to the 3 existing `useUnreadCount` consumer components (`AppSidebar`, `BottomNav`, `MainLayout`) — the hook's return type (`number`) stays the same.
- No real-time subscription setup — the existing `useUnreadCount` hook already has a real-time Supabase channel.

---

## 2. Current Architecture

### 2.1 Service Layer (Phases 1–3, frozen)

```
┌─────────────────────────────────────────────┐
│           NotificationService               │
│  create(supabase).create(type, uid, data)   │
│  createMany(supabase).createMany(inputs[])  │
│  markAsRead(supabase).markAsRead(id)        │
│  markAllAsRead(supabase).markAllAsRead()    │
│  delete(supabase).delete(id)                │
│  getNotifications(supabase).get(params)     │
│  getUnreadCount(supabase).getUnreadCount()  │
│  getNotification(supabase).get(id)          │
│  getPreferences(supabase).getPreferences()  │
│  setPreferences(supabase).set(prefs)        │
└─────────────────────────────────────────────┘
```

### 2.2 Current Integration Pattern

**Write-side** (Phase 3 complete): 35 call sites use:
```typescript
createNotificationService(supabase).create('type', userId, { ... }).catch(console.error);
```

**Read-side** (Phase 4 target): Components still bypass the service layer:

- `src/hooks/useUnreadCount.ts` — already uses `@tanstack/react-query` + real-time subscription, but makes an inline `supabase.from('notifications').select(...)` call instead of `NotificationService.getUnreadCount()`.
- `src/pages/NotificationsPage.tsx` — uses inline `supabase.from('notifications').select(...)` queries with manual pagination state.

### 2.3 Data Flow (Current)

```
  Write (create):
  Component → createNotificationService(supabase).create() → Supabase DB
      │
      ▼
  Real-time channel (already in useUnreadCount.ts) → invalidates React Query cache

  Read (query):
  useUnreadCount → inline supabase.from('notifications') → React Query cache → number
  NotificationsPage → inline supabase.from('notifications') → component state
```

### 2.4 Key Files Involved

| File | Role |
|------|------|
| `src/services/NotificationService.ts` | Frozen — 10 methods |
| `src/types/notifications.ts` | Frozen — types & interfaces |
| `src/hooks/useUnreadCount.ts` | Already uses React Query + real-time — **update query function only** |
| `src/pages/NotificationsPage.tsx` | UI page — **refactor to use service hooks** |
| `src/components/AppSidebar.tsx` | Consumer of `useUnreadCount()` — **no change needed** |
| `src/components/ui/BottomNav.tsx` | Consumer of `useUnreadCount()` — **no change needed** |
| `src/components/layouts/MainLayout.tsx` | Consumer of `useUnreadCount()` — **no change needed** |

### 2.5 Existing Infrastructure Already in Place

| Asset | Location | Status |
|-------|----------|--------|
| `@tanstack/react-query` v5.83.0 | `package.json` | Already installed |
| `QueryClientProvider` | `src/App.tsx` | Already configured |
| React Query `useQuery` + `useQueryClient` | `src/hooks/useUnreadCount.ts` | Already in use |
| Supabase Realtime channel (notifications) | `src/hooks/useUnreadCount.ts` | Already subscribed |

---

## 3. Components That Will Be Modified

### 3.1 New Components to Create

| Component | Purpose |
|-----------|---------|
| `useNotificationQueries()` | React Query hooks wrapping `getNotifications`, `getUnreadCount`, `getNotification` |
| `useNotificationMutations()` | React Query mutations wrapping `markAsRead`, `markAllAsRead`, `delete` |
| `useNotificationPreferences()` | React Query hook wrapping `getPreferences` / `setPreferences` |
| `<NotificationPreferencesPanel>` | UI component — toggle switches for each notification preference key |

### 3.2 Existing Components to Modify

| Component | Modification |
|-----------|-------------|
| `src/hooks/useUnreadCount.ts` | Replace inline `supabase.from('notifications').select(...)` query function with `NotificationService.getUnreadCount()`. Preserve React Query + real-time infrastructure. Return type (`number`) stays identical. |
| `src/pages/NotificationsPage.tsx` | Replace inline `supabase.from('notifications')` queries with `NotificationService.getNotifications()`, `markAsRead()`, `markAllAsRead()`, `delete()`. |

### 3.3 Components That Must NOT Change

| Component | Reason |
|-----------|--------|
| `AppSidebar`, `BottomNav`, `MainLayout` | Already consume `useUnreadCount(): number`. Hook's return type stays the same. |

---

## 4. Files Expected to Change

| File | Change Type |
|------|-------------|
| `src/hooks/useUnreadCount.ts` | **Minimal update** — replace inline query function with `createNotificationService(supabase).getUnreadCount()`. Everything else (React Query, real-time channel, return type) stays. |
| `src/hooks/useNotificationQueries.ts` | **New** — React Query hooks for `getNotifications`, `getUnreadCount`, `getNotification` |
| `src/hooks/useNotificationMutations.ts` | **New** — React Query mutations for `markAsRead`, `markAllAsRead`, `delete` |
| `src/hooks/useNotificationPreferences.ts` | **New** — React Query for `getPreferences` / `setPreferences` |
| `src/pages/NotificationsPage.tsx` | **Refactor** — replace inline Supabase queries with hooks |
| `src/components/notifications/NotificationPreferencesPanel.tsx` | **New** |

**Total files: ~6**

---

## 5. Data Flow Before and After

### 5.1 Current Data Flow

```
  useUnreadCount():
  inline supabase.from('notifications').select(..., { count: 'exact', head: true })
    → React Query cache → number
    ← real-time channel invalidates cache

  NotificationsPage:
  inline supabase.from('notifications').select(...).range(...)
    → component-local state (useState)
```

### 5.2 Proposed Data Flow (After Phase 4)

```
  useUnreadCount():
  createNotificationService(supabase).getUnreadCount()
    → React Query cache → number    (same return type, same real-time invalidation)

  NotificationsPage:
  useNotificationQueries().getNotifications({ page, pageSize })
    → React Query cache → paginated list
  useNotificationMutations().markAsRead()
    → optimistic cache update → Supabase DB
```

**Key differences:**
1. **No inline Supabase queries.** All read operations go through the NotificationService.
2. **Consistent error handling.** The service layer normalizes errors into `NotificationError` types.
3. **Testability.** Components can be tested by mocking the service hooks, not the Supabase client.
4. **No behavioral changes.** The existing `useUnreadCount` return type (`number`) and real-time subscription are preserved.

---

## 6. Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **R1:** `NotificationsPage.tsx` has complex inline pagination and filtering logic that may be tightly coupled to the Supabase query shape. | Medium — refactoring could break pagination or filtering. | Medium | Audit the existing page thoroughly before refactoring. Use the same query params as the page currently uses. |
| **R2:** `useUnreadCount` currently uses an inline `supabase.from('notifications')` query that counts **all** unread notifications. `NotificationService.getUnreadCount()` does the same — but if RLS behavior differs subtly, counts could diverge. | Low — one-time mismatch. | Low | Add a test that calls both the inline query and the service method with a mock and asserts they return the same count. |
| **R3:** The `NotificationsPage` may use different column selections or joins than `getNotifications()` returns. | Medium — missing fields in the UI. | Medium | Compare the service's `NotificationRecord` shape against the fields used in the page's render logic before migrating. Add any missing fields to the service's select or document them as additions. |
| **R4:** Mutations (`markAsRead`, `delete`) must optimistically update both the notification list cache and the unread count cache atomically. | Medium — stale cache if only one key is invalidated. | Medium | Use React Query's `onMutate` to update both cache keys, and `onError` to roll back. |
| **R5:** The existing `useUnreadCount` hook creates a unique channel per mount (`idRef`). If refactored, the channel lifecycle must be preserved. | Low — double-subscription or stale channel. | Low | Keep the `useRef` + `useEffect` cleanup pattern from the existing implementation. |

---

## 7. Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| **E1:** User has 0 notifications. | All hooks return empty/zero states: `getNotifications` returns empty array, `getUnreadCount` returns `0`. |
| **E2:** User is logged out. | All hooks check auth state first; return defaults without making Supabase calls. Supabase RLS would reject anyway. |
| **E3:** Network error during `getNotifications`. | React Query retries (default: 3 times). If all fail, component shows error state from the hook. |
| **E4:** User deletes a notification that was already deleted (double-click). | `delete()` throws `NOT_FOUND` error. Mutation's `onError` rolls back any optimistic removal. |
| **E5:** Preferences have never been saved (no localStorage entry). | `getPreferences()` returns defaults (`{ push_enabled: true, email_enabled: true, ... }`). The panel displays these defaults. |
| **E6:** Notification list is on page 2; a real-time INSERT adds a notification to page 1. | React Query's infinite query cache shifts. Use `refetchFirstPage` on INSERT to keep consistency. |
| **E7:** Browser blocks localStorage (incognito, privacy mode). | `setPreferences()` throws a `NotificationError`. The preferences panel should show an error toast and revert the toggle. |

---

## 8. Rollback Strategy

| Step | Action |
|------|--------|
| **S1** | Before starting Phase 4, ensure the Phase 3 commit (`89de4c5`) is the last stable state. Create a Git tag: `git tag phase-3-complete`. |
| **S2** | Implement each sub-phase (hooks → page → preferences) in separate commits. |
| **S3** | After each commit, run the full gate: `npm run build`, `npx vitest run`, lint. |
| **S4** | If Phase 4 causes regressions in `useUnreadCount`: `git checkout phase-3-complete -- src/hooks/useUnreadCount.ts`. |
| **S5** | If Phase 4 causes regressions in `NotificationsPage`: `git checkout phase-3-complete -- src/pages/NotificationsPage.tsx`. |
| **S6** | New files (hooks, panel) can be deleted or reverted individually without affecting Phase 3 functionality. |
| **S7** | The 17 Phase-3-migrated files are never touched by Phase 4, so they remain safe regardless of Phase 4 rollback. |

---

## 9. Testing Strategy

### 9.1 Unit Tests (Vitest)

| Test Suite | Tests |
|------------|-------|
| `useUnreadCount` | — Calls `getUnreadCount` through the service layer<br>— Returns `0` on auth not ready<br>— Returns `0` on error |
| `useMarkAsRead` | — Calls `markAsRead` with correct ID<br>— Invalidates both notification-list and unread-count cache keys on success<br>— Rolls back optimistic update on error |
| `useDeleteNotification` | — Calls `delete` with correct ID<br>— Removes item from list cache optimistically<br>— Rolls back on error |
| `NotificationPreferencesPanel` | — Renders toggle for each preference key<br>— Calls `setPreferences` on change<br>— Displays saved state from `getPreferences` |

### 9.2 Integration Tests

- **NotificationsPage flow**: mock `getNotifications` → render page → verify paginated list → click "mark all read" → verify cache invalidation.
- **Sidebar badge**: mock `getUnreadCount` → render layout → verify badge number.

### 9.3 Manual Test Checklist

1. Open NotificationsPage → list loads with pagination.
2. Click a notification → `markAsRead` called, item visually dims, badge decrements.
3. Click "Mark all as read" → all items dim, badge goes to 0.
4. Delete a notification → item removed from list, badge decrements if unread.
5. Open a second tab → mark as read in tab A → tab B badge updates via real-time.
6. Toggle preferences → save → reload → toggle persists (localStorage).
7. Sidebar / bottom nav badge matches the unread count on NotificationsPage.
8. Log out → all notification UI hides.
9. Network offline → optimistic updates still render → toast on failure → rollback.

---

## 10. Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| **AC1** | `useUnreadCount()` returns `number` with identical signature — no breaking changes to `AppSidebar`, `BottomNav`, `MainLayout`. | TypeScript build passes; badge renders. |
| **AC2** | `useUnreadCount()` calls `NotificationService.getUnreadCount()` internally, not `supabase.from('notifications')`. | Code review. |
| **AC3** | `useUnreadCount()` real-time subscription continues to work (channel creation, invalidation on INSERT/UPDATE/DELETE). | Manual cross-tab test. |
| **AC4** | `NotificationsPage` uses `NotificationService.getNotifications()`, not inline Supabase queries. | Code review; no `supabase.from('notifications')` in the file. |
| **AC5** | "Mark as read" on a single notification updates the cache immediately and decrements unread count. | Visual test + test assertion. |
| **AC6** | "Mark all as read" updates all items and sets badge to 0. | Visual test + test assertion. |
| **AC7** | Delete removes the notification from the list and decrements badge if unread. | Visual test + test assertion. |
| **AC8** | Notification preferences panel renders toggles for all 7 keys and persists changes to localStorage. | Visual test + localStorage assertion. |
| **AC9** | No database schema changes. | `git diff -- supabase/` |
| **AC10** | `NotificationService.ts` and `types/notifications.ts` are unmodified. | `git diff` |
| **AC11** | Build passes (`npm run build`). | CI / local. |
| **AC12** | All 56 existing tests pass; new tests added for hooks and panel. | `npx vitest run` |
| **AC13** | ESLint zero new errors (pre-existing `no-explicit-any` errors tolerated). | `npx eslint src` |

---

## 11. Database Changes

**None required.**

- No new tables, columns, or enums.
- No new RPCs.
- No indexes to add or modify.

The notification preferences are stored entirely in **localStorage** (via `NotificationService.setPreferences()`), not in a database table. The existing `notifications` table and its indexes are sufficient.

---

## 12. NotificationService Changes

**None required.**

The 10-method `NotificationServiceInterface` and its implementation in `NotificationService.ts` are frozen. Phase 4 only adds a React Query wrapper layer on top. The service's interface is well-suited for React Query:

| Service Method | React Query Hook | Type |
|----------------|-------------------|------|
| `getNotifications` | `useNotifications` | `useInfiniteQuery` |
| `getUnreadCount` | `useUnreadCount` | `useQuery` (refactor existing) |
| `getNotification` | `useNotification` | `useQuery` |
| `markAsRead` | `useMarkAsRead` | `useMutation` |
| `markAllAsRead` | `useMarkAllAsRead` | `useMutation` |
| `delete` | `useDeleteNotification` | `useMutation` |
| `getPreferences` | `useNotificationPreferences` | `useQuery` |
| `setPreferences` | `useNotificationPreferences` | `useMutation` |

The `create` and `createMany` methods are intentionally **not** wrapped in React Query mutations — they are already called fire-and-forget from 35 call sites in Phase 3.

---

## 13. Performance Impact

| Aspect | Impact |
|--------|--------|
| **Bundle size** | No new dependencies — `@tanstack/react-query` is already installed. The new hooks add minimal code (< 1 kB). |
| **Network requests** | **No change.** `useUnreadCount` already uses React Query with a real-time channel. The only change is which function calls Supabase — the same query is executed. |
| **Memory** | React Query's in-memory cache stores paginated notification lists. With default `gcTime` (5 min), memory usage is proportional to the number of pages fetched. For typical users (< 50 notifications), this is negligible. |
| **Re-renders** | React Query's fine-grained subscription means only components that use a specific query key re-render when that cache entry changes. This is an improvement over any component-local `useState` approach. |
| **Real-time** | Already in use by `useUnreadCount`. No new channels are added. |

---

## 14. Security Considerations

| Consideration | Analysis |
|---------------|----------|
| **RLS remains the security boundary.** | All queries go through `createNotificationService(supabase).getXxx()` which uses the anon key and relies on Postgres Row-Level Security. React Query adds no new privileges. |
| **No bypassing of RLS.** | The hooks call the same service methods that respect RLS. There is no direct `supabase.from('notifications')` call in the hooks — they go through the service. |
| **Client-side cache sensitivity.** | Notification data is cached in the React Query store in the browser's memory. This is no less secure than the current approach (data is already in component state). |
| **Real-time authorization.** | Supabase Realtime channels respect RLS by default. The existing channel subscription already filters by `user_id`. |
| **Mutation input validation.** | The React Query mutations pass data through the service layer, which validates input (e.g., `INVALID_INPUT` errors for invalid IDs). |
| **XSS.** | Notification `body_ar` and `title_ar` are rendered as text content (not HTML) in the UI. React's default escaping prevents XSS. |
| **localStorage preferences.** | Notification preferences are stored in `localStorage` under key `miftah_notif_prefs`. No sensitive data is stored. |

---

## Appendix A: Implementation Order (Proposed)

| Step | Description | Files |
|------|-------------|-------|
| 1 | Create `src/hooks/useNotificationQueries.ts` — `useNotifications()`, `useUnreadCount()`, `useNotification(id)`. | New file |
| 2 | Create `src/hooks/useNotificationMutations.ts` — `useMarkAsRead()`, `useMarkAllAsRead()`, `useDeleteNotification()`. | New file |
| 3 | Create `src/hooks/useNotificationPreferences.ts`. | New file |
| 4 | Refactor `src/hooks/useUnreadCount.ts` — replace the inline `supabase.from('notifications')` query function with `createNotificationService(supabase).getUnreadCount()`. Preserve React Query, real-time channel, and return type. | `src/hooks/useUnreadCount.ts` |
| 5 | Create `src/components/notifications/NotificationPreferencesPanel.tsx`. | New file |
| 6 | Refactor `src/pages/NotificationsPage.tsx` — replace inline Supabase queries with the new hooks. | `src/pages/NotificationsPage.tsx` |
| 7 | Run full gate: build, lint, test. | — |

---

*End of Phase 4 Architecture Analysis. No implementation code is included in this document.*
