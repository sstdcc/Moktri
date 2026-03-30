import { Heart, BedDouble, MapPin, Clock, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MiftahBadge } from './MiftahBadge';
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
  district?: string;
  bedrooms?: number | null;
  furnishing?: string | null;
  createdAt: string;
  isFavorited?: boolean;
  isVerifiedOwner?: boolean;
  isUrgent?: boolean;
  isFeatured?: boolean;
  onFavoriteToggle?: () => void;
}

export const ListingCard = ({
  id, imageUrl, category, price, district, bedrooms, furnishing,
  createdAt, isFavorited, isVerifiedOwner, isUrgent, isFeatured, onFavoriteToggle,
}: ListingCardProps) => {
  const navigate = useNavigate();
  const daysSince = getDaysSincePublished(createdAt);

  return (
    <div
      onClick={() => navigate(`/listings/${id}`)}
      className="cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm transition-all duration-200 hover:shadow-lg hover:border-accent/30 active:scale-[0.98]"
    >
      {/* IMAGE */}
      <div className="relative h-44 w-full">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
            <Building2 className="h-12 w-12 text-primary/30" />
          </div>
        )}

        {/* Freshness badge */}
        {daysSince < 3 && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-success/90 backdrop-blur-sm px-2 py-1 text-[10px] font-bold text-white font-tajawal">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            جديد
          </span>
        )}

        {/* Status badges */}
        <div className="absolute top-2 right-2 flex gap-1" style={daysSince < 3 ? { top: '2.25rem' } : {}}>
          {isUrgent && <MiftahBadge variant="urgent" />}
          {isFeatured && <MiftahBadge variant="featured" />}
        </div>

        {/* Favorite */}
        <button
          onClick={(e) => { e.stopPropagation(); onFavoriteToggle?.(); }}
          className="absolute top-2 left-2 rounded-full bg-black/30 backdrop-blur-sm p-1.5 transition-all duration-200 hover:bg-black/50"
        >
          <Heart className={cn('h-4 w-4', isFavorited ? 'fill-danger text-danger' : 'text-white')} />
        </button>

        {/* Category badge */}
        <span className="absolute bottom-2 right-2 rounded-lg bg-black/40 backdrop-blur-sm text-white text-xs px-2 py-1 font-medium font-tajawal">
          {categoryLabels[category] || category}
        </span>
      </div>

      {/* BODY */}
      <div className="p-4">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-black text-accent font-tajawal">{fmtPrice(price)}</span>
          <span className="text-xs text-muted-foreground font-tajawal">ر.ي/شهري</span>
        </div>

        {district && (
          <div className="mt-1.5 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-accent shrink-0" />
            <span className="text-xs text-muted-foreground font-tajawal">{district}</span>
          </div>
        )}

        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground font-tajawal">
          {bedrooms != null && bedrooms > 0 && (
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" /> {bedrooms} غرف
            </span>
          )}
          {furnishing && <span>{furnishingLabels[furnishing] || furnishing}</span>}
        </div>

        <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1 text-xs text-muted-foreground font-tajawal">
          <Clock className="h-3 w-3" />
          <span>{getTimeAgo(createdAt)}</span>
        </div>
      </div>
    </div>
  );
};
