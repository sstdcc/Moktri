import { Heart, Bed, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MiftahBadge } from './MiftahBadge';
import { cn } from '@/lib/utils';

const categoryLabels: Record<string, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'منزل', floor: 'دور', shop: 'محل',
  office: 'مكتب', shared: 'مشترك', family: 'عائلي', student: 'طلاب',
};

const furnishingLabels: Record<string, string> = {
  furnished: 'مفروش', semi_furnished: 'شبه مفروش', unfurnished: 'غير مفروش',
};

const formatPrice = (price: number) => price.toLocaleString('ar-YE');

const getTimeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'اليوم';
  if (days === 1) return 'منذ يوم';
  if (days <= 10) return `منذ ${days} أيام`;
  return `منذ ${days} يوم`;
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

  return (
    <div
      onClick={() => navigate(`/listings/${id}`)}
      className="cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <span className="font-tajawal text-sm">لا توجد صورة</span>
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          <MiftahBadge variant="active" className="!text-[10px]" />
          {isUrgent && <MiftahBadge variant="urgent" />}
          {isFeatured && <MiftahBadge variant="featured" />}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onFavoriteToggle?.(); }}
          className="absolute top-2 left-2 rounded-full bg-card/80 p-1.5 backdrop-blur-sm"
        >
          <Heart className={cn('h-4 w-4', isFavorited ? 'fill-danger text-danger' : 'text-muted-foreground')} />
        </button>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-tajawal">{categoryLabels[category] || category}</span>
          {isVerifiedOwner && (
            <span className="flex items-center gap-0.5 text-[10px] text-primary font-tajawal">
              <CheckCircle className="h-3 w-3" /> موثق
            </span>
          )}
        </div>
        <p className="mt-1 text-lg font-bold text-foreground font-tajawal">
          {formatPrice(price)} <span className="text-xs font-normal text-muted-foreground">ر.ي/شهري</span>
        </p>
        {district && <p className="mt-0.5 text-xs text-muted-foreground font-tajawal">{district}</p>}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground font-tajawal">
          {bedrooms != null && (
            <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {bedrooms} غرف</span>
          )}
          {furnishing && <span>{furnishingLabels[furnishing] || furnishing}</span>}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground font-tajawal">{getTimeAgo(createdAt)}</p>
      </div>
    </div>
  );
};
