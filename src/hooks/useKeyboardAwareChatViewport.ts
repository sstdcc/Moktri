import { RefObject, useCallback, useEffect, useState } from 'react';

export const useKeyboardAwareChatViewport = (messagesEndRef: RefObject<HTMLElement>) => {
  const [viewportHeight, setViewportHeight] = useState('100dvh');

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
        setViewportHeight(visualViewport ? `${visualViewport.height}px` : '100dvh');
        scrollToBottom('smooth');
      });
    };

    syncViewport();
    visualViewport?.addEventListener('resize', syncViewport);
    visualViewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('orientationchange', syncViewport);

    return () => {
      window.cancelAnimationFrame(frame);
      visualViewport?.removeEventListener('resize', syncViewport);
      visualViewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, [scrollToBottom]);

  return { viewportHeight, scrollToBottom };
};