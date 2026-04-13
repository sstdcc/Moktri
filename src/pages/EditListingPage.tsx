import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Pause, CheckCircle, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import CreateListingPage from './CreateListingPage';
import type { Listing, ListingImage } from '@/types/database';

const EditListingPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [listingImages, setListingImages] = useState<{ url: string; path: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [dangerOpen, setDangerOpen] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      const { data } = await supabase.from('listings').select('*').eq('id', id).single();
      if (!data || data.owner_id !== user.id) { navigate('/dashboard/owner'); return; }
      setListing(data);

      const { data: imgs } = await supabase.from('listing_images').select('*').eq('listing_id', id).order('sort_order');
      if (imgs) setListingImages(imgs.map(i => ({ url: i.url, path: '' })));
      setLoading(false);
    };
    load();
  }, [id, user, navigate]);

  const handleStatusAction = async (status: string) => {
    if (!id) return;
    setActionLoading(status);
    await supabase.from('listings').update({ status: status as any, last_updated_at: new Date().toISOString() }).eq('id', id);
    setActionLoading('');
    navigate('/dashboard/owner');
  };

  const handleSave = async (form: any, images: { url: string; path: string }[], _status: string) => {
    if (!id || !user) return;
    await supabase.from('listings').update({
      category: form.category,
      title: form.title,
      governorate: form.governorate || null,
      city_name: form.city_name || null,
      district_id: form.district_id || null,
      neighborhood: form.neighborhood || null,
      price: Number(form.price),
      currency: form.currency,
      billing_period: form.billing_period,
      is_negotiable: form.is_negotiable,
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      kitchens: form.kitchens,
      floor_number: form.floor_number,
      property_size: form.property_size ? Number(form.property_size) : null,
      furnishing: form.furnishing,
      allowed_for: form.allowed_for,
      has_water: form.has_water,
      has_electricity: form.has_electricity,
      has_parking: form.has_parking,
      has_internet: form.has_internet,
      description: form.description,
      is_urgent: form.is_urgent,
      last_updated_at: new Date().toISOString(),
    }).eq('id', id);

    // Update images
    await supabase.from('listing_images').delete().eq('listing_id', id);
    if (images.length > 0) {
      await supabase.from('listing_images').insert(
        images.map((img, i) => ({ listing_id: id, url: img.url, is_primary: i === 0, sort_order: i }))
      );
    }
    navigate(`/listings/${id}`);
  };

  if (loading) return <LoadingSpinner />;
  if (!listing) return null;

  const initialData = {
    category: listing.category,
    title: listing.title,
    governorate: listing.governorate || '',
    city_name: listing.city_name || '',
    district_id: listing.district_id || '',
    neighborhood: listing.neighborhood || '',
    price: Number(listing.price) as any,
    currency: listing.currency || 'YER',
    billing_period: listing.billing_period || 'monthly',
    is_negotiable: listing.is_negotiable || false,
    bedrooms: listing.bedrooms || 0,
    bathrooms: listing.bathrooms || 0,
    kitchens: listing.kitchens || 0,
    floor_number: listing.floor_number || 0,
    property_size: listing.property_size ? Number(listing.property_size) as any : '',
    furnishing: listing.furnishing || '',
    allowed_for: listing.allowed_for || 'all',
    has_water: listing.has_water || false,
    has_electricity: listing.has_electricity || false,
    has_parking: listing.has_parking || false,
    has_internet: listing.has_internet || false,
    description: listing.description || '',
    is_urgent: listing.is_urgent || false,
  };

  return (
    <div className="min-h-screen bg-background font-tajawal">
      {/* Danger zone */}
      <div className="px-4 pt-2">
        <Collapsible open={dangerOpen} onOpenChange={setDangerOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-bold text-danger transition-all duration-200 hover:bg-danger/10 font-tajawal">
              <AlertTriangle className="h-4 w-4" />
              إجراءات متقدمة
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2 border-border text-foreground">
                  <Pause className="h-4 w-4" /> إيقاف الإعلان مؤقتاً
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="font-tajawal">
                <AlertDialogHeader>
                  <AlertDialogTitle>إيقاف الإعلان مؤقتاً</AlertDialogTitle>
                  <AlertDialogDescription>سيتم إخفاء إعلانك من نتائج البحث. يمكنك إعادة تفعيله لاحقاً.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleStatusAction('paused')} disabled={!!actionLoading}>
                    {actionLoading === 'paused' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تأكيد الإيقاف'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2 border-border text-foreground">
                  <CheckCircle className="h-4 w-4 text-success" /> تعيين كمؤجر ✓
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="font-tajawal">
                <AlertDialogHeader>
                  <AlertDialogTitle>تعيين كمؤجر</AlertDialogTitle>
                  <AlertDialogDescription>سيتم تعيين هذا العقار كمؤجر وإخفائه من نتائج البحث.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleStatusAction('rented')}>تأكيد</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-2">
                  <Trash2 className="h-4 w-4" /> حذف الإعلان نهائياً
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="font-tajawal">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-danger">⚠️ حذف الإعلان نهائياً</AlertDialogTitle>
                  <AlertDialogDescription className="text-danger/80">هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الإعلان نهائياً من النظام.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleStatusAction('rejected')} className="bg-danger hover:bg-danger/90">حذف نهائياً</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <CreateListingPage
        initialData={initialData}
        initialImages={listingImages}
        isEditing
        listingId={id}
        onSave={handleSave}
      />
    </div>
  );
};

export default EditListingPage;
