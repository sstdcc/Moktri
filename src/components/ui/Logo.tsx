import logoSrc from '@/assets/moktari-logo.png';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  alt?: string;
  /** Wrap the logo in a soft premium rounded surface container. */
  framed?: boolean;
  /** Extra classes for the frame container (when framed). */
  frameClassName?: string;
}

/**
 * Official Moktari (مُكتري) logo.
 * - Default: plain image. Use a sizing class via `className` (e.g. h-9 w-9).
 * - `framed`: wraps the logo in a soft rounded surface for splash/auth screens.
 */
export const Logo = ({ className, alt = 'Moktari (مُكتري)', framed = false, frameClassName }: LogoProps) => {
  const img = (
    <img
      src={logoSrc}
      alt={alt}
      className={cn('object-contain select-none', framed ? 'h-full w-full' : className)}
      draggable={false}
    />
  );

  if (!framed) return img;

  return (
    <div
      className={cn(
        // Soft premium surface — calm, no glow, no harsh border
        'inline-flex items-center justify-center rounded-3xl',
        'bg-card/80 dark:bg-card/60 backdrop-blur-sm',
        'ring-1 ring-border/40 dark:ring-border/30',
        'p-4',
        className,
        frameClassName,
      )}
    >
      {img}
    </div>
  );
};

export default Logo;
