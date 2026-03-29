import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/ui/BottomNav';
import { ListingCard } from '@/components/ui/ListingCard';
import type { District, Listing } from '@/types/database';

const categoryChips = [
  { value: 'house', label: 'بيت', emoji: '🏠' },
  { value: 'apartment', label: 'شقة', emoji: '🏢' },
  { value: 'room', label: 'غرفة', emoji: '🚪' },
  { value: 'floor', label: 'دور', emoji: '🏬' },
  { value: 'shop', label: 'محل', emoji: '🏪' },
  { value: 'office', label: 'مكتب', emoji: '🏢' },
];

const steps = [
  { num: 1, emoji: '🔍', title: 'ابحث عن العقار', subtitle: 'تصفح مئات الإعلانات في تعز' },
  { num: 2, emoji: '📞', title: 'تواصل مع المالك', subtitle: 'اتصل مباشرة أو عبر واتساب بدون وسيط' },
  { num: 3, emoji: '🏠', title: 'انتقل لبيتك', subtitle: 'أتمم الاتفاق وانتقل لسكنك الجديد' },
];

interface ListingWithImage extends Listing {
  listing_images: { url: string; is_primary: boolean | null }[];
  districts: { name_ar: string } | null;
}

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [featuredListings, setFeaturedListings] = useState<ListingWithImage[]>([]);
  const [latestListings, setLatestListings] = useState<ListingWithImage[]>([]);
  const [urgentListings, setUrgentListings] = useState<ListingWithImage[]>([]);

  useEffect(() => {
    fetchDistricts();
    fetchFeaturedListings();
    fetchLatestListings();
    fetchUrgentListings();
  }, []);

  const fetchDistricts = async () => {
    const { data } = await supabase
      .from('districts')
      .select('*')
      .eq('is_active', true)
      .order('name_ar');
    if (data) setDistricts(data);
    setDistrictsLoading(false);
  };

  const fetchFeaturedListings = async () => {
    const { data } = await supabase
      .from('listings')
      .select('*, listing_images(url, is_primary), districts(name_ar)')
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
      <section className="bg-primary px-4 pb-8 pt-10">
        <h1 className="text-3xl font-extrabold text-primary-foreground">مفتاح</h1>
        <p className="mt-1 text-base text-primary-foreground/90">ابحث عن سكنك في تعز</p>
        <p className="mt-0.5 text-xs text-primary-foreground/70">آلاف الإعلانات من الملاك والدلالين</p>

        <form onSubmit={handleSearch} className="mt-5 flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالحي أو اسم المنطقة..."
            className="flex-1 rounded-lg bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button type="submit" className="rounded-lg bg-accent px-4 py-3 text-accent-foreground transition-colors hover:bg-accent/90">
            <Search className="h-5 w-5" />
          </button>
        </form>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categoryChips.map((chip) => (
            <button
              key={chip.value}
              onClick={() => navigate(`/listings?category=${chip.value}`)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs text-primary-foreground backdrop-blur-sm transition-colors hover:bg-primary-foreground/20"
            >
              <span>{chip.emoji}</span>
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* DISTRICTS */}
      <section className="px-4 py-6">
        <h2 className="mb-4 text-lg font-bold text-foreground">تصفح حسب الحي</h2>
        {districtsLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {districts.map((d) => (
              <button
                key={d.id}
                onClick={() => navigate(`/listings?district=${d.id}`)}
                className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-md"
              >
                <span className="text-sm font-bold text-foreground">{d.name_ar}</span>
                <span className="mt-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
                  {d.listing_count || 0} إعلان
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* FEATURED */}
      {featuredListings.length > 0 && (
        <section className="py-4">
          <h2 className="mb-3 px-4 text-lg font-bold text-foreground">إعلانات مميزة ⭐</h2>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
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
        <h2 className="mb-3 text-lg font-bold text-foreground">أحدث الإعلانات</h2>
        {latestListings.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
        <button
          onClick={() => navigate('/listings')}
          className="mt-4 w-full text-center text-sm font-medium text-accent hover:underline"
        >
          عرض جميع الإعلانات ←
        </button>
      </section>

      {/* URGENT */}
      {urgentListings.length > 0 && (
        <section className="py-4">
          <h2 className="mb-3 px-4 text-lg font-bold text-foreground">إعلانات عاجلة 🔴</h2>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
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
        <h2 className="mb-4 text-lg font-bold text-foreground">كيف يعمل مفتاح؟</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {steps.map((step) => (
            <div key={step.num} className="flex w-52 shrink-0 flex-col items-center rounded-xl border border-border bg-card p-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-lg font-bold text-accent-foreground">
                {step.num}
              </div>
              <span className="mt-2 text-2xl">{step.emoji}</span>
              <h3 className="mt-2 text-sm font-bold text-foreground">{step.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{step.subtitle}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOUSING REQUEST CTA */}
      <section className="px-4 pb-8">
        <div className="rounded-2xl bg-gradient-to-l from-primary to-[hsl(207,60%,22%)] p-6 text-center">
          <h2 className="text-xl font-bold text-primary-foreground">لم تجد ما تبحث عنه؟</h2>
          <p className="mt-2 text-sm text-primary-foreground/80">انشر طلب سكن وسيتواصل معك الملاك والدلالون مباشرة</p>
          <button
            onClick={() => navigate(user ? '/requests/new' : '/auth?returnUrl=/requests/new')}
            className="mt-4 rounded-lg bg-accent px-6 py-3 text-sm font-bold text-accent-foreground transition-colors hover:bg-accent/90"
          >
            انشر طلب سكن الآن
          </button>
        </div>
      </section>

      <BottomNav />
    </div>
  );
};

export default HomePage;
