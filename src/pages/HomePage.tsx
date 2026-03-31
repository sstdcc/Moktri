import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, Building2, DoorOpen, Layers, Store, Briefcase, MapPin, Phone, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDistricts } from '@/contexts/DistrictsContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { BottomNav } from '@/components/ui/BottomNav';
import { ListingCard } from '@/components/ui/ListingCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import SmartNudgeBanner from '@/components/SmartNudgeBanner';
import type { Listing } from '@/types/database';

const categoryChips = [
  { value: 'house', label: 'بيت', icon: Home },
  { value: 'apartment', label: 'شقة', icon: Building2 },
  { value: 'room', label: 'غرفة', icon: DoorOpen },
  { value: 'floor', label: 'دور', icon: Layers },
  { value: 'shop', label: 'محل', icon: Store },
  { value: 'office', label: 'مكتب', icon: Briefcase },
];

const steps = [
  { num: 1, icon: Search, title: 'ابحث عن العقار', subtitle: 'تصفح مئات الإعلانات في تعز' },
  { num: 2, icon: Phone, title: 'تواصل مع المالك', subtitle: 'اتصل مباشرة أو عبر واتساب بدون وسيط' },
  { num: 3, icon: Home, title: 'انتقل لبيتك', subtitle: 'أتمم الاتفاق وانتقل لسكنك الجديد' },
];

interface ListingWithImage extends Listing {
  listing_images: { url: string; is_primary: boolean | null }[];
  districts: { name_ar: string } | null;
}

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { districts, loading: districtsLoading } = useDistricts();
  usePageTitle();
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredListings, setFeaturedListings] = useState<ListingWithImage[]>([]);
  const [latestListings, setLatestListings] = useState<ListingWithImage[]>([]);
  const [urgentListings, setUrgentListings] = useState<ListingWithImage[]>([]);

  useEffect(() => {
    fetchFeaturedListings();
    fetchLatestListings();
    fetchUrgentListings();
  }, []);

  const fetchFeaturedListings = async () => {
    const { data } = await supabase
      .from('listings')
      .select('*, listing_images(url, is_primary), districts(name_ar, city)')
      .eq('is_featured', true)
      .eq('status', 'active')
      .limit(6);
    if (data) setFeaturedListings(data as unknown as ListingWithImage[]);
  };

  const fetchLatestListings = async () => {
    const { data } = await supabase
      .from('listings')
      .select('*, listing_images(url, is_primary), districts(name_ar)')
      .eq('status', 'active')
      .order('published_at', { ascending: false })
      .limit(6);
    if (data) setLatestListings(data as unknown as ListingWithImage[]);
  };

  const fetchUrgentListings = async () => {
    const { data } = await supabase
      .from('listings')
      .select('*, listing_images(url, is_primary), districts(name_ar)')
      .eq('is_urgent', true)
      .eq('status', 'active')
      .limit(4);
    if (data) setUrgentListings(data as unknown as ListingWithImage[]);
  };

  const getPrimaryImage = (listing: ListingWithImage) => {
    const primary = listing.listing_images?.find(img => img.is_primary);
    return primary?.url || listing.listing_images?.[0]?.url;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/listings?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="min-h-screen bg-background pb-20 font-tajawal">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary to-[hsl(207,60%,22%)] px-4 pb-8 pt-10">
        {/* Pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-primary-foreground tracking-tight">مفتاح</h1>
          <span className="mt-2 inline-block rounded-full bg-accent/20 text-accent text-xs px-3 py-1 font-medium">
            تعز • اليمن
          </span>
          <p className="mt-2 text-lg font-medium text-primary-foreground/90">ابحث عن سكنك في تعز</p>
          <p className="mt-0.5 text-sm text-primary-foreground/60">آلاف الإعلانات من الملاك والدلالين</p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mt-6 flex items-center gap-2 rounded-2xl bg-white p-2 shadow-xl">
            <Search className="h-5 w-5 text-accent mr-1 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالحي أو اسم المنطقة..."
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none px-1"
            />
            <button
              type="submit"
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white flex items-center gap-2 transition-all duration-200 hover:bg-accent/90 shrink-0"
            >
              <Search className="h-4 w-4" />
              بحث
            </button>
          </form>

          {/* Category chips */}
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {categoryChips.map((chip) => {
              const Icon = chip.icon;
              return (
                <button
                  key={chip.value}
                  onClick={() => navigate(`/listings?category=${chip.value}`)}
                  className="flex shrink-0 items-center gap-2 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 px-4 py-2.5 text-xs font-medium text-white transition-all duration-200 hover:bg-accent hover:border-accent"
                >
                  <Icon className="h-4 w-4" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* SMART NUDGES */}
      {user && (
        <section className="px-4 pt-4">
          <SmartNudgeBanner />
        </section>
      )}

      {/* DISTRICTS */}
      <section className="px-4 py-6">
        <SectionTitle title="تصفح حسب الحي" />
        {districtsLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {districts.map((d) => (
              <button
                key={d.id}
                onClick={() => navigate(`/listings?district=${d.id}`)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-accent/40 active:scale-95"
              >
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <MapPin className="h-[18px] w-[18px] text-accent" />
                </div>
                <span className="text-sm font-bold text-foreground text-center">{d.name_ar}</span>
                <span className="rounded-full bg-accent/10 text-accent text-xs px-2 py-0.5 font-medium">
                  {(d.listing_count || 0) > 0 ? `${d.listing_count} إعلان` : 'جديد'}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* FEATURED */}
      {featuredListings.length > 0 && (
        <section className="py-4">
          <div className="px-4">
            <SectionTitle title="إعلانات مميزة" />
          </div>
          <div className="flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {featuredListings.map((listing) => (
              <div key={listing.id} className="w-64 shrink-0">
                <ListingCard
                  id={listing.id}
                  imageUrl={getPrimaryImage(listing)}
                  category={listing.category}
                  price={Number(listing.price)}
                  district={listing.districts?.name_ar}
                  bedrooms={listing.bedrooms}
                  furnishing={listing.furnishing}
                  createdAt={listing.created_at || ''}
                  isFeatured
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* LATEST */}
      <section className="px-4 py-4">
        <SectionTitle
          title="أحدث الإعلانات"
          action={{ label: 'عرض الكل', href: '/listings' }}
        />
        {latestListings.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {latestListings.map((listing) => (
              <ListingCard
                key={listing.id}
                id={listing.id}
                imageUrl={getPrimaryImage(listing)}
                category={listing.category}
                price={Number(listing.price)}
                district={listing.districts?.name_ar}
                bedrooms={listing.bedrooms}
                furnishing={listing.furnishing}
                createdAt={listing.created_at || ''}
              />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">لا توجد إعلانات حالياً</p>
        )}
      </section>

      {/* URGENT */}
      {urgentListings.length > 0 && (
        <section className="py-4">
          <div className="px-4">
            <SectionTitle title="إعلانات عاجلة" />
          </div>
          <div className="flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {urgentListings.map((listing) => (
              <div key={listing.id} className="w-64 shrink-0">
                <ListingCard
                  id={listing.id}
                  imageUrl={getPrimaryImage(listing)}
                  category={listing.category}
                  price={Number(listing.price)}
                  district={listing.districts?.name_ar}
                  bedrooms={listing.bedrooms}
                  furnishing={listing.furnishing}
                  createdAt={listing.created_at || ''}
                  isUrgent
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section className="px-4 py-6">
        <div className="bg-muted/40 rounded-3xl p-6">
          <SectionTitle title="كيف يعمل مفتاح؟" />
          <div className="flex flex-col gap-4 mt-2">
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              return (
                <div key={step.num} className="relative flex items-start gap-4">
                  {/* Connecting line */}
                  {idx < steps.length - 1 && (
                    <div className="absolute right-5 top-10 h-full border-r-2 border-dashed border-accent/30" />
                  )}
                  {/* Number circle */}
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-black text-sm shrink-0 relative z-10">
                    {step.num}
                  </div>
                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2">
                      <StepIcon className="h-5 w-5 text-accent" />
                      <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{step.subtitle}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOUSING REQUEST CTA */}
      <section className="px-4 pb-8">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary to-[hsl(207,70%,15%)]">
          {/* Decorative circles */}
          <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-accent/10" />

          <div className="relative z-10 p-6">
            <span className="inline-block rounded-full bg-accent/20 text-accent text-xs px-3 py-1 font-medium mb-3">
              للباحثين عن سكن
            </span>
            <h2 className="text-xl font-black text-white">لم تجد ما تبحث عنه؟</h2>
            <p className="mt-2 text-sm text-white/70">انشر طلب سكن وسيتواصل معك الملاك والدلالون مباشرة</p>
            <button
              onClick={() => navigate(user ? '/requests/new' : '/auth?returnUrl=/requests/new')}
              className="mt-5 w-full rounded-2xl bg-accent py-3.5 text-sm font-bold text-white flex items-center justify-center gap-2 transition-all duration-200 hover:bg-accent/90"
            >
              انشر طلب سكن الآن
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <BottomNav />
    </div>
  );
};

export default HomePage;
