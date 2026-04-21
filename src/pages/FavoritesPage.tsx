import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { BottomNav } from '@/components/ui/BottomNav';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListingCard } from '@/components/ui/ListingCard';
import { useFavorites } from '@/hooks/useFavorites';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Heart, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface FavListing {
  favoriteId: string;
  id: string;
  ownerId?: string;
  category: string;
  price: number;
  createdAt: string;
  district?: string;
  bedrooms?: number | null;
  furnishing?: string | null;
  imageUrl?: string;
  isUrgent?: boolean;
  isFeatured?: boolean;
}

const FavoritesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FavListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setError(false);
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('favorites')
        .select(`
          id,
          listing_id,
          listings!favorites_listing_id_fkey (
            id, category, price, created_at, bedrooms, furnishing,
            is_urgent, is_featured, status,
            districts!listings_district_id_fkey ( name_ar ),
            listing_images!listing_images_listing_id_fkey ( url, is_primary )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (err) throw err;

      const mapped: FavListing[] = (data ?? [])
        .filter((f: any) => f.listings)
        .map((f: any) => {
          const l = f.listings;
          const primaryImg = l.listing_images?.find((img: any) => img.is_primary)?.url
            || l.listing_images?.[0]?.url;
          return {
            favoriteId: f.id,
            id: l.id,
            ownerId: l.owner_id,
            category: l.category,
            price: l.price,
            createdAt: l.created_at,
            district: l.districts?.name_ar,
            bedrooms: l.bedrooms,
            furnishing: l.furnishing,
            imageUrl: primaryImg,
            isUrgent: l.is_urgent,
            isFeatured: l.is_featured,
          };
        });
      setItems(mapped);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('favorites-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'favorites',
        filter: `user_id=eq.${user.id}`,
      }, () => { fetchFavorites(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchFavorites]);

  const removeFavorite = async (favoriteId: string) => {
    // Optimistic removal
    setItems(prev => prev.filter(i => i.favoriteId !== favoriteId));
    const { error } = await supabase.from('favorites').delete().eq('id', favoriteId);
    if (error) {
      toast.error('تعذر إزالة العنصر');
      fetchFavorites();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-20 font-tajawal" dir="rtl">
        <PageHeader title="المفضلة" showBack />
        <EmptyState
          icon={Heart}
          title="سجّل دخولك أولاً"
          subtitle="لعرض إعلاناتك المحفوظة"
          actionLabel="تسجيل الدخول"
          onAction={() => navigate('/auth?returnUrl=/favorites')}
        />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 font-tajawal" dir="rtl">
      <PageHeader title={`المفضلة${!loading && items.length > 0 ? ` (${items.length})` : ''}`} showBack />

      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-44 w-full rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-destructive text-sm">تعذر تحميل المفضلة</p>
            <Button variant="outline" size="sm" onClick={fetchFavorites}>
              <RefreshCw className="h-4 w-4 ml-2" />
              إعادة المحاولة
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="لا توجد إعلانات محفوظة"
            subtitle="تصفح الإعلانات وأضف ما يعجبك"
            actionLabel="تصفح الإعلانات"
            onAction={() => navigate('/listings')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {items.map(item => (
              <ListingCard
                key={item.id}
                id={item.id}
                category={item.category}
                price={item.price}
                district={item.district}
                bedrooms={item.bedrooms}
                furnishing={item.furnishing}
                createdAt={item.createdAt}
                imageUrl={item.imageUrl}
                isFavorited={true}
                isUrgent={item.isUrgent}
                isFeatured={item.isFeatured}
                ownerId={item.ownerId}
                onFavoriteToggle={() => removeFavorite(item.favoriteId)}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default FavoritesPage;
