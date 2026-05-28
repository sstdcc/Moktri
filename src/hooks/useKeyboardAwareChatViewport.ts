import { RefObject, useCallback, useEffect, useState } from 'react';

export const useKeyboardAwareChatViewport = (messagesEndRef: RefObject<HTMLElement>) => {
  const [keyboardInset, setKeyboardInset] = useState(0);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  }, [messagesEndRef]);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    let frame = 0;

    const syncViewport = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nextInset = visualViewport
          ? Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)
          : 0;
        setKeyboardInset(Math.round(nextInset));
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        scrollToBottom('smooth');
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

  return { keyboardInset, scrollToBottom };
};