import { useState, useRef, useEffect } from 'react';
import { Heart, BedDouble, MapPin, Clock, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MiftahBadge } from './MiftahBadge';
import { SmartImage } from './SmartImage';
import { RatingDisplay } from '@/components/rating/RatingDisplay';
import { cn } from '@/lib/utils';
import { formatPrice as fmtPrice, timeAgo } from '@/lib/format';

const categoryLabels: Record<string, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'منزل', floor: 'دور', shop: 'محل',
  office: 'مكتب', shared: 'مشترك', family: 'عائلي', student: 'طلاب',
};

const furnishingLabels: Record<string, string> = {
  furnished: 'مفروش', semi_furnished: 'شبه مفروش', unfurnished: 'غير مفروش',
};

const getDaysSincePublished = (date: string) => {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
};

interface ListingCardProps {
  id: string;
  imageUrl?: string;
  category: string;
  price: number;
  city?: string;
  district?: string;
  bedrooms?: number | null;
  furnishing?: string | null;
  createdAt: string;
  isFavorited?: boolean;
  isVerifiedOwner?: boolean;
  isUrgent?: boolean;
  isFeatured?: boolean;
  ownerId?: string;
  index?: number;
  onFavoriteToggle?: () => void;
}

export const ListingCard = ({
  id, imageUrl, category, price, city, district, bedrooms, furnishing,
  createdAt, isFavorited, isVerifiedOwner, isUrgent, isFeatured, ownerId, index = 0, onFavoriteToggle,
}: ListingCardProps) => {
  const navigate = useNavigate();
  const daysSince = getDaysSincePublished(createdAt);
  const [pop, setPop] = useState(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setPop((p) => p + 1);
  }, [isFavorited]);

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFavoriteToggle?.();
  };

  return (
    <div
      onClick={() => navigate(`/listings/${id}`)}
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
      className="animate-card-in cursor-pointer overflow-hidden rounded-2xl border border-border/40 bg-card shadow-card transition-all duration-300 hover:shadow-elevated hover:border-accent/25 active:scale-[0.98] group"
    >
      {/* IMAGE */}
      <div className="relative h-48 w-full overflow-hidden">
        <SmartImage
          src={imageUrl}
          alt=""
          wrapperClassName="absolute inset-0"
          className="transition-transform duration-500 group-hover:scale-105"
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/8 to-accent/8">
              <Building2 className="h-14 w-14 text-primary/20 stroke-[1.2px]" />
            </div>
          }
        />


        {/* Gradient overlay at bottom for readability */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Freshness badge */}
        {daysSince < 3 && (
          <span className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-success/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white font-tajawal shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            جديد
          </span>
        )}

        {/* Status badges */}
        <div className="absolute top-3 right-3 flex gap-1.5" style={daysSince < 3 ? { top: '2.5rem' } : {}}>
          {isUrgent && <MiftahBadge variant="urgent" />}
          {isFeatured && <MiftahBadge variant="featured" />}
        </div>

        {/* Favorite */}
        <button
          onClick={(e) => { e.stopPropagation(); onFavoriteToggle?.(); }}
          className={cn(
            'absolute top-3 left-3 rounded-xl p-2 transition-all duration-200 active:scale-90',
            isFavorited
              ? 'bg-danger/15 backdrop-blur-md'
              : 'bg-black/25 backdrop-blur-md hover:bg-black/40'
          )}
        >
          <Heart className={cn('h-[18px] w-[18px] transition-all', isFavorited ? 'fill-danger text-danger' : 'text-white')} />
        </button>

        {/* Category badge — bottom of image */}
        <span className="absolute bottom-3 right-3 rounded-lg bg-black/50 backdrop-blur-md text-white text-[11px] px-2.5 py-1 font-semibold font-tajawal">
          {categoryLabels[category] || category}
        </span>
      </div>

      {/* BODY */}
      <div className="p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-accent font-tajawal tracking-tight">{fmtPrice(price)}</span>
            <span className="text-[11px] text-muted-foreground font-tajawal">ر.ي/شهري</span>
          </div>
          {ownerId && <RatingDisplay userId={ownerId} variant="compact" size="sm" />}
        </div>

        {(city || district) && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-accent/70 shrink-0" />
            <span className="text-[13px] text-muted-foreground font-tajawal">
              {city && district ? `${city} • ${district}` : city || district}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-tajawal">
          {bedrooms != null && bedrooms > 0 && (
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5 stroke-[1.8px]" /> {bedrooms} غرف
            </span>
          )}
          {furnishing && <span>{furnishingLabels[furnishing] || furnishing}</span>}
        </div>

        <div className="pt-3 border-t border-border/40 flex items-center gap-1.5 text-[11px] text-muted-foreground/70 font-tajawal">
          <Clock className="h-3 w-3 stroke-[1.8px]" />
          <span>{timeAgo(createdAt)}</span>
        </div>
      </div>
    </div>
  );
};
