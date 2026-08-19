import { useEffect } from 'react';

const TAGGED = 'data-moktari-seo';

interface SeoOptions {
  title?: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
  /** Absolute URL used for og:image + twitter:image. Omit to leave the default. */
  ogImage?: string;
}

const setOrCreateMeta = (selector: string, attribute: 'name' | 'property', name: string, content: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, name);
    el.setAttribute(TAGGED, 'true');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const setOrCreateCanonical = (href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    el.setAttribute(TAGGED, 'true');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

const setRobots = (noindex: boolean) => {
  const existing = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (noindex) {
    if (existing) {
      existing.setAttribute('content', 'noindex, nofollow');
    } else {
      const el = document.createElement('meta');
      el.setAttribute('name', 'robots');
      el.setAttribute('content', 'noindex, nofollow');
      el.setAttribute(TAGGED, 'true');
      document.head.appendChild(el);
    }
    return;
  }
  document.head.querySelectorAll<HTMLMetaElement>(`meta[name="robots"][${TAGGED}]`)
    .forEach((el) => el.remove());
};

export const useSeo = ({
  title,
  description,
  canonicalPath,
  noindex,
  ogImage,
}: SeoOptions) => {
  useEffect(() => {
    const canonical = canonicalPath
      ? `${window.location.origin}${canonicalPath === '/' ? '' : canonicalPath}`
      : undefined;

    if (title) {
      document.title = title;
      setOrCreateMeta('meta[property="og:title"]', 'property', 'og:title', title);
      setOrCreateMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    }
    if (description) {
      setOrCreateMeta('meta[name="description"]', 'name', 'description', description);
      setOrCreateMeta('meta[property="og:description"]', 'property', 'og:description', description);
      setOrCreateMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    }
    if (canonical) {
      setOrCreateCanonical(canonical);
      setOrCreateMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    }
    if (ogImage) {
      setOrCreateMeta('meta[property="og:image"]', 'property', 'og:image', ogImage);
      setOrCreateMeta('meta[name="twitter:image"]', 'name', 'twitter:image', ogImage);
    }
    if (typeof noindex === 'boolean') {
      setRobots(noindex);
    }
  }, [title, description, canonicalPath, noindex, ogImage]);
};
