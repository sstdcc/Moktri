import logoSrc from '@/assets/moktari-logo.png';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  alt?: string;
}

/**
 * Official Moktari (مُكتري) logo.
 * Use a sizing class via `className` (e.g. h-12 w-12, h-16 w-16).
 */
export const Logo = ({ className, alt = 'Moktari (مُكتري)' }: LogoProps) => (
  <img
    src={logoSrc}
    alt={alt}
    className={cn('object-contain select-none', className)}
    draggable={false}
  />
);

export default Logo;
