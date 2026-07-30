# Phase 6 Technical Specification — Notification Preferences Integration

## 1. Objectives

1. **Eliminate duplicate localStorage logic** — Remove the independent notification preference implementation in `SettingsPage.tsx` that duplicates `NotificationService`. Replace direct `localStorage.getItem`/`setItem` calls with `NotificationService.getPreferences()` / `setPreferences()`.

2. **No new infrastructure** — Preferences stay in localStorage. No React Query, no database, no server state. The service methods are called directly.

3. **Preserve existing behavior** — The localStorage key (`miftah_notif_prefs`), the 7 preference fields, the Arabic labels, and the toggle-switch UI remain identical. Only the data access layer changes.

## 2. Files to Modify

| Action | File | Lines Affected |
|--------|------|---------------|
| Edit | `src/pages/SettingsPage.tsx` | ~20 lines changed |

**No new files created.** No changes to `NotificationService.ts`, `types/notifications.ts`, `services/index.ts`, or any hook file.

## 3. Exact Implementation Tasks

### Task: Refactor `SettingsPage.tsx`

**Purpose:** Replace the duplicated localStorage logic with calls to `NotificationService.getPreferences()` and `setPreferences()`.

#### a. Add import (at the import block, near line 3)

```
import { supabase } from '@/integrations/supabase/client';
import { createNotificationService } from '@/services';
import type { NotificationPreferences } from '@/types/notifications';
```

If `supabase` is already imported (check — it may not be), only add the `createNotificationService` and `NotificationPreferences` imports.

#### b. Remove duplicate constants (lines 33–53)

Remove:
```
- const NOTIF_PREFS_KEY = 'miftah_notif_prefs';
-
- const defaultNotifPrefs = {
-   new_response: true,
-   listing_expiring: true,
-   listing_approved: true,
-   listing_rejected: true,
-   verification_update: true,
-   new_report: true,
-   system: true,
- };
```

Keep `notifLabels` — these are UI display labels (Arabic text) that do not exist anywhere else.

#### c. Replace local state initialization and useEffect (lines 138, 141–151)

Change:
```
- const [notifPrefs, setNotifPrefs] = useState(defaultNotifPrefs);
```
To:
```
const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
```

Replace the useEffect block (lines 141–151):
```
-   useEffect(() => {
-     if (profile) {
-       setFullName(profile.full_name || '');
-       setBio(profile.bio || '');
-       setAvatarUrl(profile.avatar_url || '');
-     }
-     try {
-       const saved = localStorage.getItem(NOTIF_PREFS_KEY);
-       if (saved) setNotifPrefs(JSON.parse(saved));
-     } catch { /* ignore */ }
-   }, [profile]);
```
To:
```
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
    }
    setNotifPrefs(createNotificationService(supabase).getPreferences());
  }, [profile]);
```

#### d. Replace toggle function (lines 217–221)

Change:
```
- const toggleNotifPref = (key: string) => {
-   const updated = { ...notifPrefs, [key]: !notifPrefs[key as keyof typeof notifPrefs] };
-   setNotifPrefs(updated);
-   localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
- };
```
To:
```
  const toggleNotifPref = (key: keyof NotificationPreferences) => {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    try {
      createNotificationService(supabase).setPreferences(updated);
    } catch {
      setNotifPrefs(notifPrefs);
      toast.error('تعذر حفظ التفضيلات');
    }
  };
```

#### e. Update JSX type cast (line 338)

Change:
```
checked={notifPrefs[key as keyof typeof notifPrefs]}
onCheckedChange={() => toggleNotifPref(key)}
```
To:
```
checked={notifPrefs?.[key as keyof NotificationPreferences] ?? true}
onCheckedChange={() => toggleNotifPref(key as keyof NotificationPreferences)}
```

## 4. Architecture

```
Before:  SettingsPage → localStorage.getItem/setItem (direct, no validation)
         NotificationService → localStorage.getItem/setItem (with validation)
         TWO independent code paths for the same data.

After:   SettingsPage → NotificationService.get/setPreferences → localStorage
         ONE code path. Validation in the service. Error handling in the service.
```

`getPreferences()` returns defaults on any error (missing key, parse failure, invalid structure) — this replaces the bare `JSON.parse` with no validation.
`setPreferences()` validates input via `isValidPreferences()` and throws `NotificationError` on failure — this replaces the unconditional `localStorage.setItem`.

## 5. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `getPreferences()` is async (returns `Promise`), but the current code reads synchronously | Low | Medium | `getPreferences()` is `async` but the implementation is entirely synchronous (localStorage calls). The `await` resolves on the same microtask. SettingsPage's `useEffect` can be `async` or use `.then()`. Alternatively, the service could expose a synchronous helper — but wrapping with `.then(setNotifPrefs)` is simpler. |
| `setPreferences()` throws on invalid input | Low | Low | input is always valid because the toggle function toggles an existing valid state. The try-catch handles unexpected failures. |
| User has corrupted localStorage from the old bare `JSON.parse` | Low | Low | `getPreferences()` handles this — returns defaults on parse failure. The corrupted data is effectively deleted. |

**Implementation note on async handling:**

`getPreferences()` returns `Promise<NotificationPreferences>`. In the `useEffect`, call it as:

```
createNotificationService(supabase).getPreferences().then(setNotifPrefs);
```

This is safe because the function is internally synchronous (no real I/O). The `.then()` runs on the same tick. No loading states are needed.

## 6. Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC1 | `SettingsPage` has zero references to `localStorage.getItem`, `localStorage.setItem`, `NOTIF_PREFS_KEY`, or `defaultNotifPrefs` | Grep confirms no matches |
| AC2 | `SettingsPage` calls `createNotificationService(supabase).getPreferences()` on mount to load preferences | Code review |
| AC3 | `SettingsPage` calls `createNotificationService(supabase).setPreferences(updated)` on each toggle | Code review |
| AC4 | Toggling a notification preference persists to `localStorage` (same key `miftah_notif_prefs`) | Open Settings → toggle a pref → verify localStorage value changed |
| AC5 | Refreshing the SettingsPage preserves the toggled preference state | Toggle → refresh → toggle shows saved state |
| AC6 | A failed preference save reverts the toggle and shows `toast.error` | Simulate `localStorage.setItem` quota error → verify toast + toggle reverts |
| AC7 | Corrupted localStorage is handled gracefully (returns defaults) | Manually corrupt `miftah_notif_prefs` → open Settings → all toggles show `true` (defaults) |
| AC8 | Build has zero errors | `npm run build` exits with code 0 |
| AC9 | All 56 existing tests pass | `vitest run` reports 56/56 passed |
