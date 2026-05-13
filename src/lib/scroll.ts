type ScrollPoint = {
  top: number;
  left: number;
};

const PAGE_SCROLL_SELECTOR = '[data-scroll-container="page"]';

export const getPageScrollContainers = (): HTMLElement[] => {
  const marked = Array.from(document.querySelectorAll<HTMLElement>(PAGE_SCROLL_SELECTOR));
  if (marked.length > 0) return marked;

  return Array.from(document.querySelectorAll<HTMLElement>('main')).filter((element) => {
    const style = window.getComputedStyle(element);
    const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY);
    return canScrollY || element.scrollHeight > element.clientHeight;
  });
};

export const getCurrentScrollPoint = (): ScrollPoint => {
  const [primaryContainer] = getPageScrollContainers();
  return {
    top: primaryContainer?.scrollTop ?? window.scrollY ?? document.documentElement.scrollTop ?? 0,
    left: primaryContainer?.scrollLeft ?? window.scrollX ?? document.documentElement.scrollLeft ?? 0,
  };
};

export const scrollAppTo = ({ top, left }: ScrollPoint) => {
  const containers = getPageScrollContainers();

  window.scrollTo({ top, left, behavior: 'auto' });
  const scrollingElement = document.scrollingElement as HTMLElement | null;
  if (scrollingElement) {
    scrollingElement.scrollTop = top;
    scrollingElement.scrollLeft = left;
  }
  document.documentElement.scrollTop = top;
  document.documentElement.scrollLeft = left;
  document.body.scrollTop = top;
  document.body.scrollLeft = left;

  containers.forEach((element) => {
    element.scrollTop = top;
    element.scrollLeft = left;
  });
};

export const scrollAppToTop = () => scrollAppTo({ top: 0, left: 0 });

export const scheduleScrollReset = (callback: () => void) => {
  callback();

  const animationFrames = [
    requestAnimationFrame(callback),
    requestAnimationFrame(() => requestAnimationFrame(callback)),
  ];
  const timers = [80, 180, 320].map((delay) => window.setTimeout(callback, delay));

  return () => {
    animationFrames.forEach(cancelAnimationFrame);
    timers.forEach(window.clearTimeout);
  };
};