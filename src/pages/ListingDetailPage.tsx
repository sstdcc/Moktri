import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, MapPin, Eye, Clock, Camera, Flag, ChevronLeft, ChevronRight, Bed, Bath, UtensilsCrossed, Ruler, Building, Armchair, Users, Share2, MessageCircle } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { PageHeader } from '@/components/ui/PageHeader';
import { MiftahBadge } from '@/components/ui/MiftahBadge';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { ListingCard } from '@/components/ui/ListingCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Listing, Profile, District } from '@/types/database';
import { ChatModal } from '@/components/chat/ChatModal';

interface FullListing extends Listing {
  listing_images: { id: string; url: string; is_primary: boolean | null; sort_order: number | null }[];
  districts: District | null;
  profiles: Profile | null;
}

const categoryLabels: Record<string, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'منزل', floor: 'دور', shop: 'محل',
  office: 'مكتب', shared: 'مشترك', family: 'عائلي', student: 'طلاب',
};
const furnishingLabels: Record<string, string> = {
  furnished: 'مفروش', semi_furnished: 'شبه مفروش', unfurnished: 'غير مفروش',
};
const allowedLabels: Record<string, string> = {
  family: 'عائلات', bachelors: 'عزّاب', students: 'طلاب', all: 'الجميع',
};
const billingLabels: Record<string, string> = {
  monthly: 'شهرياً', yearly: 'سنوياً', daily: 'يومياً',
};
const reportReasons = [
  { value: 'fake', label: 'إعلان وهمي' },
  { value: 'wrong_price', label: 'سعر خاطئ' },
  { value: 'inappropriate', label: 'صور مضللة' },
  { value: 'already_rented', label: 'تم التأجير' },
  { value: 'spam', label: 'محتوى مسيء' },
  { value: 'other', label: 'أخرى' },
];

const getTimeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'اليوم';
  if (days === 1) return 'منذ يوم';
  if (days <= 10) return `منذ ${days} أيام`;
  return `منذ ${days} يوم`;
};

const getDaysDiff = (date: string) => Math.floor((Date.now() - new Date(date).getTime()) / 86400000);

const ListingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<FullListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { isFavorited: isFavoritedFn, toggleFavorite } = useFavorites();
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [similarListings, setSimilarListings] = useState<any[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({ direction: 'rtl', loop: true });

  useEffect(() => {
    if (!id) return;
    fetchListing();
  }, [id]);

  const fetchListing = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('listings')
      .select('*, listing_images(*), districts(*), profiles!owner_id(*)')
      .eq('id', id!)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }

    setListing(data as unknown as FullListing);
    setLoading(false);

    // Increment view
    const viewKey = `viewed_${id}`;
    if (!localStorage.getItem(viewKey)) {
      localStorage.setItem(viewKey, '1');
      await supabase.rpc('increment_listing_views', { p_listing_id: id! });
    }

    // Fetch similar
    fetchSimilar(data.district_id, data.category, data.id);
  };

  const fetchSimilar = async (districtId: string | null, category: string, excludeId: string) => {
    if (!districtId) return;
    const { data } = await supabase
      .from('listings')
      .select('*, listing_images(url, is_primary), districts(name_ar, city)')
      .eq('district_id', districtId)
      .eq('category', category as any)
      .eq('status', 'active')
      .neq('id', excludeId)
      .limit(4);
    if (data) setSimilarListings(data);
  };

  const handleToggleFavorite = () => {
    if (!id) return;
    toggleFavorite(id);
  };

  const handleWhatsApp = async () => {
    if (!user) { toast.info('سجل دخولك للتواصل مع المالك'); navigate(`/auth?returnUrl=/listings/${id}`); return; }
    const phone = listing?.profiles?.whatsapp_number || listing?.profiles?.phone;
    if (!phone) return;
    await supabase.rpc('increment_whatsapp_clicks', { p_listing_id: id! });
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  };

  const handleCall = async () => {
    if (!user) { toast.info('سجل دخولك للتواصل مع المالك'); navigate(`/auth?returnUrl=/listings/${id}`); return; }
    const phone = listing?.profiles?.phone;
    if (!phone) return;
    await supabase.rpc('increment_contact_clicks', { p_listing_id: id! });
    window.open(`tel:${phone}`, '_self');
  };

  const submitReport = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!reportReason || !id) return;
    setReportSubmitting(true);
    await supabase.from('reports').insert({
      reporter_id: user.id,
      target_type: 'listing' as any,
      target_id: id,
      reason: reportReason as any,
    });
    setReportSubmitting(false);
    setReportOpen(false);
    toast.success('تم إرسال البلاغ بنجاح');
  };

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCurrentImageIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    onSelect();
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  const handleOpenChat = () => {
    if (!user) {
      toast.info('سجل دخولك للتواصل مع المالك');
      navigate(`/auth?returnUrl=/listings/${id}`);
      return;
    }
    if (user.id === listing?.owner_id) {
      toast.info('لا يمكنك مراسلة نفسك');
      return;
    }
    setChatOpen(true);
  };

  if (loading) return <LoadingSpinner />;
  if (!listing) return (
    <div className="min-h-screen bg-background font-tajawal">
      <PageHeader title="غير موجود" showBack />
      <p className="p-8 text-center text-muted-foreground">الإعلان غير موجود</p>
    </div>
  );

  const images = listing.listing_images?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) || [];
  const owner = listing.profiles;
  const lastUpdatedDays = listing.last_updated_at ? getDaysDiff(listing.last_updated_at) : 0;
  const publishedDays = listing.published_at ? getDaysDiff(listing.published_at) : 999;

  const detailItems = [
    { icon: Bed, label: 'غرف النوم', value: listing.bedrooms },
    { icon: Bath, label: 'الحمامات', value: listing.bathrooms },
    { icon: UtensilsCrossed, label: 'المطابخ', value: listing.kitchens },
    { icon: Ruler, label: 'المساحة', value: listing.property_size ? `${listing.property_size} م²` : null },
    { icon: Building, label: 'الطابق', value: listing.floor_number },
    { icon: Armchair, label: 'التأثيث', value: listing.furnishing ? furnishingLabels[listing.furnishing] : null },
    { icon: Users, label: 'مناسب لـ', value: listing.allowed_for ? allowedLabels[listing.allowed_for] : null },
  ].filter(item => item.value != null);

  const amenities = [
    { label: 'ماء', available: listing.has_water },
    { label: 'كهرباء', available: listing.has_electricity },
    { label: 'إنترنت', available: listing.has_internet },
    { label: 'موقف', available: listing.has_parking },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 font-tajawal overflow-x-hidden">
      {/* Header with favorite */}
      <PageHeader
        title="تفاصيل العرض"
        showBack
        action={
          <div className="flex items-center gap-1">
            <button onClick={async () => {
              const url = `${window.location.origin}/listings/${id}`;
              if (navigator.share) {
                try { await navigator.share({ title: listing.title, url }); } catch {}
              } else {
                await navigator.clipboard.writeText(url);
                toast.success('تم نسخ الرابط');
              }
            }} className="p-2"><Share2 className="h-5 w-5 text-foreground" /></button>
            <button onClick={toggleFavorite} className="p-2">
              <Heart className={cn('h-5 w-5', isFavorited ? 'fill-danger text-danger' : 'text-foreground')} />
            </button>
          </div>
        }
      />

      {/* Freshness warnings */}
      {lastUpdatedDays > 90 && (
        <div className="bg-danger/10 px-4 py-2 text-center text-xs text-danger">⛔ إعلان قديم جداً — قد لا يكون متاحاً</div>
      )}
      {lastUpdatedDays > 45 && lastUpdatedDays <= 90 && (
        <div className="bg-accent/10 px-4 py-2 text-center text-xs text-accent">⚠️ هذا الإعلان لم يُحدَّث منذ أكثر من ٤٥ يوماً — تحقق من توفره</div>
      )}

      {/* Image Gallery */}
      <div className="relative overflow-hidden">
        {images.length > 0 ? (
          <>
            <div ref={emblaRef} className="overflow-hidden">
              <div className="flex">
                {images.map((img) => (
                  <div key={img.id} className="min-w-0 shrink-0 grow-0 basis-full">
                    <img src={img.url} alt="" className="aspect-[4/3] w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
            {images.length > 1 && (
              <>
                <button onClick={scrollPrev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 backdrop-blur-sm transition-colors hover:bg-black/60">
                  <ChevronLeft className="h-5 w-5 text-white" />
                </button>
                <button onClick={scrollNext} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 backdrop-blur-sm transition-colors hover:bg-black/60">
                  <ChevronRight className="h-5 w-5 text-white" />
                </button>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {images.map((_, i) => (
                    <button key={i} onClick={() => emblaApi?.scrollTo(i)} className={cn('h-2 rounded-full transition-all', i === currentImageIndex ? 'w-5 bg-accent' : 'w-2 bg-white/50')} />
                  ))}
                </div>
                <div className="absolute top-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                  {currentImageIndex + 1} / {images.length}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-muted">
            <div className="text-center text-muted-foreground">
              <Camera className="mx-auto h-10 w-10 mb-2" />
              <p className="text-sm">لا توجد صور</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {publishedDays < 3 && <MiftahBadge variant="active" className="!bg-success/10 !text-success" />}
          {listing.category && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{categoryLabels[listing.category]}</span>}
          {listing.is_urgent && <MiftahBadge variant="urgent" />}
          {listing.is_featured && <MiftahBadge variant="featured" />}
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-foreground">{listing.title}</h1>

        {/* Price */}
        <p className="mt-2 text-2xl font-extrabold text-accent">
          {Number(listing.price).toLocaleString('ar-YE')} <span className="text-sm font-normal text-muted-foreground">ريال / {billingLabels[listing.billing_period || 'monthly']}</span>
        </p>
        {listing.is_negotiable && <p className="mt-0.5 text-xs text-muted-foreground">السعر قابل للتفاوض</p>}

        {/* Location & stats */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {listing.districts && (
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {listing.districts.city ? `${listing.districts.city} • ` : ''}{listing.districts.name_ar}{listing.neighborhood ? ` — ${listing.neighborhood}` : ''}</span>
          )}
          {listing.published_at && (
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {getTimeAgo(listing.published_at)}</span>
          )}
          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {listing.views_count || 0} مشاهدة</span>
          <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {listing.favorites_count || 0}</span>
        </div>

        {/* Property details grid */}
        {detailItems.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            {detailItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
                <item.icon className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium text-foreground">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Amenities */}
        <div className="mt-4 flex flex-wrap gap-2">
          {amenities.map(a => (
            <span key={a.label} className={cn(
              'rounded-full px-3 py-1 text-xs font-medium',
              a.available ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
            )}>
              {a.available ? '✓' : '✗'} {a.label}
            </span>
          ))}
        </div>

        {/* Description */}
        {listing.description && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-bold text-foreground">الوصف</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {showFullDesc || listing.description.length <= 200
                ? listing.description
                : listing.description.slice(0, 200) + '...'}
            </p>
            {listing.description.length > 200 && (
              <button onClick={() => setShowFullDesc(!showFullDesc)} className="mt-1 text-xs font-medium text-accent">
                {showFullDesc ? 'عرض أقل' : 'عرض المزيد'}
              </button>
            )}
          </div>
        )}

        {/* Owner card */}
        {owner && (
          <div
            onClick={() => navigate(`/profile/${owner.id}`)}
            className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 overflow-hidden shrink-0">
              {owner.avatar_url ? (
                <img src={owner.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-primary">{owner.full_name?.charAt(0) || '؟'}</span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">{owner.full_name}</p>
                {owner.is_verified && <VerifiedBadge size="sm" />}
              </div>
              <p className="text-[10px] text-muted-foreground">
                عضو منذ {new Date(owner.created_at || '').getFullYear()} • {owner.total_listings || 0} إعلان
              </p>
            </div>
          </div>
        )}

        {/* Report */}
        <button onClick={() => setReportOpen(true)} className="mt-4 text-xs text-muted-foreground hover:text-danger">
          ⚑ الإبلاغ عن هذا الإعلان
        </button>

        {/* Similar listings */}
        {similarListings.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-bold text-foreground">إعلانات مشابهة في نفس الحي</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {similarListings.map((sl: any) => (
                <div key={sl.id} className="w-56 shrink-0">
                  <ListingCard
                    id={sl.id}
                    imageUrl={sl.listing_images?.find((i: any) => i.is_primary)?.url || sl.listing_images?.[0]?.url}
                    category={sl.category}
                    price={Number(sl.price)}
                    district={sl.districts?.name_ar}
                    bedrooms={sl.bedrooms}
                    furnishing={sl.furnishing}
                    createdAt={sl.created_at || ''}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky contact bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card p-3 pb-safe">
        <button
          onClick={handleOpenChat}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent/90"
        >
          <MessageCircle className="h-5 w-5" />
          مراسلة
        </button>
      </div>

      {/* Chat modal */}
      {listing && owner && (
        <ChatModal
          open={chatOpen}
          onOpenChange={setChatOpen}
          listingId={listing.id}
          ownerId={listing.owner_id}
          listingTitle={listing.title}
          ownerName={owner.full_name || 'المالك'}
        />
      )}

      {/* Report sheet */}
      <Sheet open={reportOpen} onOpenChange={setReportOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl font-tajawal">
          <SheetHeader>
            <SheetTitle className="text-right font-tajawal">الإبلاغ عن الإعلان</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 pb-4">
            {reportReasons.map(r => (
              <label key={r.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reportReason === r.value}
                  onChange={() => setReportReason(r.value)}
                  className="accent-accent"
                />
                <span className="text-sm text-foreground">{r.label}</span>
              </label>
            ))}
            <Button
              onClick={submitReport}
              disabled={!reportReason || reportSubmitting}
              className="w-full"
              variant="destructive"
            >
              {reportSubmitting ? 'جاري الإرسال...' : 'إرسال البلاغ'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ListingDetailPage;
