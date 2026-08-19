import { useEffect } from 'react';

const TAGGED = 'data-moktari-seo';

type JsonLdSchema = Record<string, unknown> | null | undefined;

/**
 * Injects one `<script type="application/ld+json">` per given schema.
 * All scripts are tagged so they are removed on change/unmount — this
 * prevents JSON-LD from accumulating or leaking across SPA routes.
 * Malformed input is dropped silently (never breaks React rendering).
 */
export const useJsonLd = (...schemas: JsonLdSchema[]) => {
  const serialized = JSON.stringify(schemas.filter((s) => s != null));

  useEffect(() => {
    document.head
      .querySelectorAll<HTMLScriptElement>(`script[type="application/ld+json"][${TAGGED}]`)
      .forEach((el) => el.remove());

    if (!serialized) return;

    try {
      const parsed = JSON.parse(serialized) as Record<string, unknown>[];
      for (const schema of parsed) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute(TAGGED, 'true');
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
      }
    } catch {
      // invalid JSON is dropped silently; never breaks rendering
    }
  }, [serialized]);
};