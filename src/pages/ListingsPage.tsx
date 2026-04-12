import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useDebounce } from '@/hooks/useDebounce';
import { useFavorites } from '@/hooks/useFavorites';
import { Search, X, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

import { ListingCard } from '@/components/ui/ListingCard';
import { FilterSheet, type FilterValues } from '@/components/ui/FilterSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import type { Listing } from '@/types/database';

interface ListingWithRelations extends Listing {
  listing_images: { url: string; is_primary: boolean | null }[];
  districts: { name_ar: string; city: string | null } | null;
}

const PAGE_SIZE = 12;

const sortOptions = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'price_asc', label: 'الأقل سعراً' },
  { value: 'price_desc', label: 'الأعلى سعراً' },
  { value: 'views', label: 'الأكثر مشاهدة' },
  { value: 'favorites', label: 'الأكثر تفضيلاً' },
];

const categoryLabels: Record<string, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'بيت', floor: 'دور', shop: 'محل',
  office: 'مكتب', shared: 'مشترك', family: 'عائلي', student: 'طلابي',
};

const ListingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  usePageTitle();
  const { isFavorited, toggleFavorite } = useFavorites();
  const [listings, setListings] = useState<ListingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const debouncedSearch = useDebounce(searchInput, 380);

  const getFiltersFromParams = useCallback((): FilterValues => ({
    category: searchParams.get('category') || undefined,
    district: searchParams.get('district') || undefined,
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    bedrooms: searchParams.get('bedrooms') ? Number(searchParams.get('bedrooms')) : undefined,
    furnishing: searchParams.get('furnishing') || undefined,
    allowedFor: searchParams.get('allowedFor') || undefined,
    hasWater: searchParams.get('hasWater') === 'true' || undefined,
    hasElectricity: searchParams.get('hasElectricity') === 'true' || undefined,
    hasParking: searchParams.get('hasParking') === 'true' || undefined,
    hasInternet: searchParams.get('hasInternet') === 'true' || undefined,
  }), [searchParams]);

  const filters = getFiltersFromParams();
  const query = searchParams.get('q') || '';

  const fetchListings = useCallback(async (pageNum: number, append = false) => {
    setLoading(true);
    let q = supabase
      .from('listings')
      .select('*, listing_images(url, is_primary), districts(name_ar, city)', { count: 'exact' })
      .eq('status', 'active');

    if (query) q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%,neighborhood.ilike.%${query}%`);
    if (filters.category) q = q.eq('category', filters.category as any);
    if (filters.district) q = q.eq('district_id', filters.district);
    if (filters.minPrice) q = q.gte('price', filters.minPrice);
    if (filters.maxPrice) q = q.lte('price', filters.maxPrice);
    if (filters.bedrooms && filters.bedrooms < 4) q = q.eq('bedrooms', filters.bedrooms);
    if (filters.bedrooms && filters.bedrooms >= 4) q = q.gte('bedrooms', 4);
    if (filters.furnishing) q = q.eq('furnishing', filters.furnishing as any);
    if (filters.allowedFor) q = q.eq('allowed_for', filters.allowedFor as any);
    if (filters.hasWater) q = q.eq('has_water', true);
    if (filters.hasElectricity) q = q.eq('has_electricity', true);
    if (filters.hasParking) q = q.eq('has_parking', true);
    if (filters.hasInternet) q = q.eq('has_internet', true);

    switch (sortBy) {
      case 'price_asc': q = q.order('price', { ascending: true }); break;
      case 'price_desc': q = q.order('price', { ascending: false }); break;
      case 'views': q = q.order('views_count', { ascending: false }); break;
      case 'favorites': q = q.order('favorites_count', { ascending: false }); break;
      default: q = q.order('published_at', { ascending: false, nullsFirst: false });
    }

    const from = pageNum * PAGE_SIZE;
    q = q.range(from, from + PAGE_SIZE - 1);

    const { data, count } = await q;
    const results = (data || []) as unknown as ListingWithRelations[];
    setListings(prev => append ? [...prev, ...results] : results);
    setTotalCount(count || 0);
    setHasMore(results.length === PAGE_SIZE);
    setLoading(false);
  }, [query, filters, sortBy]);

  useEffect(() => {
    setPage(0);
    fetchListings(0);
  }, [searchParams, sortBy]);

  // Auto-search on debounced input change
  useEffect(() => {
    const currentQ = searchParams.get('q') || '';
    if (debouncedSearch.trim() !== currentQ) {
      const params = new URLSearchParams(searchParams);
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
      else params.delete('q');
      setSearchParams(params, { replace: true });
    }
  }, [debouncedSearch]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchListings(nextPage, true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput.trim()) params.set('q', searchInput.trim());
    else params.delete('q');
    setSearchParams(params);
  };

  const handleFilterApply = (newFilters: FilterValues) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (newFilters.category) params.set('category', newFilters.category);
    if (newFilters.district) params.set('district', newFilters.district);
    if (newFilters.minPrice) params.set('minPrice', String(newFilters.minPrice));
    if (newFilters.maxPrice) params.set('maxPrice', String(newFilters.maxPrice));
    if (newFilters.bedrooms) params.set('bedrooms', String(newFilters.bedrooms));
    if (newFilters.furnishing) params.set('furnishing', newFilters.furnishing);
    if (newFilters.allowedFor) params.set('allowedFor', newFilters.allowedFor);
    if (newFilters.hasWater) params.set('hasWater', 'true');
    if (newFilters.hasElectricity) params.set('hasElectricity', 'true');
    if (newFilters.hasParking) params.set('hasParking', 'true');
    if (newFilters.hasInternet) params.set('hasInternet', 'true');
    setSearchParams(params);
  };

  const removeFilter = (key: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete(key);
    setSearchParams(params);
  };

  const activeFilterChips: { key: string; label: string }[] = [];
  if (filters.category) activeFilterChips.push({ key: 'category', label: categoryLabels[filters.category] || filters.category });
  if (filters.minPrice) activeFilterChips.push({ key: 'minPrice', label: `من ${filters.minPrice}` });
  if (filters.maxPrice) activeFilterChips.push({ key: 'maxPrice', label: `إلى ${filters.maxPrice}` });
  if (filters.bedrooms) activeFilterChips.push({ key: 'bedrooms', label: `${filters.bedrooms}+ غرف` });
  if (filters.furnishing) activeFilterChips.push({ key: 'furnishing', label: filters.furnishing === 'furnished' ? 'مفروش' : filters.furnishing === 'semi_furnished' ? 'نصف مفروش' : 'غير مفروش' });
  if (filters.hasWater) activeFilterChips.push({ key: 'hasWater', label: 'ماء' });
  if (filters.hasElectricity) activeFilterChips.push({ key: 'hasElectricity', label: 'كهرباء' });

  const getPrimaryImage = (l: ListingWithRelations) => {
    const primary = l.listing_images?.find(img => img.is_primary);
    return primary?.url || l.listing_images?.[0]?.url;
  };

  return (
    <div className="min-h-screen bg-background pb-20 font-tajawal">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-card px-4 pb-3 pt-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ابحث في الإعلانات..."
              className="w-full rounded-lg border border-border bg-background py-2.5 pr-10 pl-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </form>

        <div className="mt-2 flex items-center gap-2">
          <FilterSheet onApply={handleFilterApply} initialValues={filters} />

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground"
            >
              {sortOptions.find(s => s.value === sortBy)?.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showSortMenu && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-border bg-card py-1 shadow-lg">
                {sortOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                    className={cn('block w-full px-3 py-2 text-right text-xs', sortBy === opt.value ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-muted')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active filter chips */}
          <div className="flex flex-1 gap-1.5 overflow-x-auto scrollbar-hide">
            {activeFilterChips.map(chip => (
              <span key={chip.key} className="flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-[10px] text-accent">
                {chip.label}
                <button onClick={() => removeFilter(chip.key)}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground">
          عُثر على <span className="font-bold text-foreground">{totalCount}</span> إعلاناً
        </p>
      </div>

      {/* Listings grid */}
      <div className="px-4">
        {loading && listings.length === 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState
            icon={Search}
            title="لا توجد إعلانات تطابق بحثك"
            subtitle="جرّب تعديل الفلاتر أو البحث بكلمات مختلفة"
            actionLabel="مسح الفلاتر"
            onAction={() => setSearchParams(new URLSearchParams())}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {listings.map(listing => (
                <ListingCard
                  key={listing.id}
                  id={listing.id}
                  imageUrl={getPrimaryImage(listing)}
                  category={listing.category}
                  price={Number(listing.price)}
                  city={listing.districts?.city ?? undefined}
                  district={listing.districts?.name_ar}
                  bedrooms={listing.bedrooms}
                  furnishing={listing.furnishing}
                  createdAt={listing.created_at || ''}
                  isUrgent={listing.is_urgent || false}
                  isFeatured={listing.is_featured || false}
                  isFavorited={isFavorited(listing.id)}
                  onFavoriteToggle={() => toggleFavorite(listing.id)}
                />
              ))}
            </div>
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="mx-auto mt-6 block rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {loading ? 'جاري التحميل...' : 'تحميل المزيد'}
              </button>
            )}
          </>
        )}
      </div>

      
    </div>
  );
};

export default ListingsPage;
