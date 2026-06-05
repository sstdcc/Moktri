import { RefObject, useCallback, useEffect, useState } from 'react';

/**
 * Drives a chat layout from the visual viewport so the on-screen keyboard
 * never overlaps the header or input.
 *
 * Strategy:
 *  - Track `visualViewport.height` and expose it as `viewportHeight`.
 *    The chat container sets its height to this value, which always
 *    excludes the keyboard area on iOS Safari and Android Chrome.
 *  - Lock document scrolling so the browser cannot pan the page when the
 *    keyboard opens (which is what causes the header to disappear under
 *    the URL bar / status bar).
 *  - Provide a `scrollToBottom` that runs after layout so new messages
 *    and keyboard transitions both land at the latest message.
 */
export const useKeyboardAwareChatViewport = (messagesEndRef: RefObject<HTMLElement>) => {
  const [viewportHeight, setViewportHeight] = useState<number>(() =>
    typeof window === 'undefined'
      ? 0
      : Math.round(window.visualViewport?.height ?? window.innerHeight),
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  }, [messagesEndRef]);

  useEffect(() => {
    const vv = window.visualViewport;
    let frame = 0;

    const sync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const h = Math.round(vv?.height ?? window.innerHeight);
        setViewportHeight((prev) => (prev === h ? prev : h));
        // Keep the document pinned to the top so the browser cannot scroll
        // the whole page when the keyboard opens.
        window.scrollTo(0, 0);
        scrollToBottom('smooth');
      });
    };

    // Lock page scroll while the chat is mounted.
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyWidth: body.style.width,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.width = '100%';

    sync();
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('orientationchange', sync);

    return () => {
      window.cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('orientationchange', sync);
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.width = prev.bodyWidth;
    };
  }, [scrollToBottom]);

  return { viewportHeight, scrollToBottom };
};
