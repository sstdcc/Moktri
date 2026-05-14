import { useEffect, useRef, useState } from 'react';

const DRAFT_VERSION = 1;
const DRAFT_PREFIX = 'moktari:create-listing-draft';

export type DraftMode =
  | { kind: 'new' }
  | { kind: 'private'; renterId: string }
  | { kind: 'edit'; listingId: string };

export function getDraftKey(userId: string | undefined, mode: DraftMode): string | null {
  if (!userId) return null;
  if (mode.kind === 'edit') return null; // never persist edit flow
  const suffix = mode.kind === 'private' ? `private:${mode.renterId}` : 'new';
  return `${DRAFT_PREFIX}:v${DRAFT_VERSION}:${userId}:${suffix}`;
}

export interface DraftPayload<F, I> {
  step: number;
  form: F;
  images: I[];
  savedAt: number;
}

export function loadDraft<F, I>(key: string | null): DraftPayload<F, I> | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload<F, I>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (e) {
    console.warn('[draft] failed to parse draft', e);
    return null;
  }
}

export function clearDraft(key: string | null) {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

/**
 * Debounced auto-save of the listing draft to localStorage.
 * Skips persistence when key is null (e.g. edit mode or signed-out).
 */
export function useDraftAutoSave<F, I>(
  key: string | null,
  step: number,
  form: F,
  images: I[],
  enabled = true,
  delay = 500,
) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!key || !enabled) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        const payload: DraftPayload<F, I> = { step, form, images, savedAt: Date.now() };
        window.localStorage.setItem(key, JSON.stringify(payload));
      } catch (e) {
        console.warn('[draft] save failed', e);
      }
    }, delay);
    return () => clearTimeout(timer.current);
  }, [key, enabled, delay, step, form, images]);
}

/** Restore the draft once on mount. Returns whether a draft was loaded. */
export function useDraftRestore<F, I>(
  key: string | null,
  apply: (d: DraftPayload<F, I>) => void,
): boolean {
  const [restored] = useState(() => {
    const d = loadDraft<F, I>(key);
    if (d) {
      try {
        apply(d);
        return true;
      } catch (e) {
        console.warn('[draft] restore failed', e);
      }
    }
    return false;
  });
  return restored;
}
