import { RefObject, useCallback, useEffect, useState } from 'react';

export const useKeyboardAwareChatViewport = (messagesEndRef: RefObject<HTMLElement>) => {
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      window.requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
      });
    },
    [messagesEndRef],
  );

  useEffect(() => {
    const visualViewport = window.visualViewport;
    let frame = 0;
    let lastInset = 0;

    const syncViewport = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const vvHeight = visualViewport?.height ?? window.innerHeight;
        const vvOffsetTop = visualViewport?.offsetTop ?? 0;
        const nextInset = visualViewport
          ? Math.max(0, window.innerHeight - vvHeight - vvOffsetTop)
          : 0;
        const rounded = Math.round(nextInset);
        setKeyboardInset(rounded);
        // Make the chat container fit exactly inside the visible viewport
        // (excludes the on-screen keyboard area).
        setViewportHeight(Math.round(vvHeight));
        window.scrollTo(0, 0);
        // When the keyboard appears, ensure the latest message stays visible
        // with a small offset above the input.
        if (rounded > 0 && rounded !== lastInset) {
          window.setTimeout(() => scrollToBottom('smooth'), 50);
        } else {
          scrollToBottom('smooth');
        }
        lastInset = rounded;
      });
    };

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    syncViewport();
    visualViewport?.addEventListener('resize', syncViewport);
    visualViewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('orientationchange', syncViewport);

    return () => {
      window.cancelAnimationFrame(frame);
      visualViewport?.removeEventListener('resize', syncViewport);
      visualViewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [scrollToBottom]);

  return { keyboardInset, viewportHeight, scrollToBottom };
};
