import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListingCard } from '@/components/ui/ListingCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  User, Building2, MessageSquare, Calendar,
  RefreshCw, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { UserRatingsSection } from '@/components/rating/UserRatingsSection';
import { RatingDisplay } from '@/components/rating/RatingDisplay';

const roleLabels: Record<string, string> = {
  renter: 'مستأجر',
  owner: 'مالك',
  broker: 'دلال',
  admin: 'مدير',
  moderator: 'مشرف',
};

const PublicProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [requestsCount, setRequestsCount] = useState(0);
  const [responsesCount, setResponsesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setError(false);
    setLoading(true);

    // 1. Fetch profile first (critical)
    const profileRes = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, bio, is_verified, verification_badge, is_active, total_listings, total_responses, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (profileRes.error || !profileRes.data) {
      console.error('[PublicProfilePage] profile fetch failed:', profileRes.error, 'id:', id);
      setError(true);
      setLoading(false);
      return;
    }
    setProfile(profileRes.data);
    setLoading(false);

    const isRenter = profileRes.data.role === 'renter';

    if (isRenter) {
      setListings([]);
      try {
        const [reqRes, respRes] = await Promise.all([
          supabase.from('housing_requests').select('id', { count: 'exact', head: true }).eq('requester_id', id),
          supabase.from('request_responses').select('id', { count: 'exact', head: true }).eq('responder_id', id),
        ]);
        setRequestsCount(reqRes.count ?? 0);
        setResponsesCount(respRes.count ?? 0);
      } catch (e) {
        console.error('[PublicProfilePage] renter stats fetch threw:', e);
        setRequestsCount(0);
        setResponsesCount(0);
      }
      return;
    }

    // 2. Fetch listings separately — failure here must NOT break the page
    try {
      const listingsRes = await supabase
        .from('listings')
        .select('*, district:districts(name_ar), listing_images(url, is_primary)')
        .eq('owner_id', id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (listingsRes.error) {
        console.error('[PublicProfilePage] listings fetch failed:', listingsRes.error);
        setListings([]);
      } else {
        setListings(listingsRes.data ?? []);
      }
    } catch (e) {
      console.error('[PublicProfilePage] listings fetch threw:', e);
      setListings([]);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Re-fetch when listings change for this profile owner (add/delete/update)
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`profile-listings-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'listings', filter: `owner_id=eq.${id}` },
        () => { fetchData(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, fetchData]);

  const getInitials = (name: string) => {
    return name?.split(' ').map((w) => w[0]).join('').slice(0, 2) || '؟';
  };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long' })
    : '';

  const displayedListings = showAll ? listings : listings.slice(0, 6);

  const getPrimaryImage = (listing: any) => {
    const primary = listing.listing_images?.find((img: any) => img.is_primary);
    return primary?.url || listing.listing_images?.[0]?.url;
  };

  return (
    <div className="min-h-screen bg-background pb-20 font-tajawal" dir="rtl">
      <PageHeader title="الملف الشخصي" showBack />

      <div className="w-full p-4">
        {loading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-destructive text-sm">تعذر تحميل الملف الشخصي</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 ml-2" />
              إعادة المحاولة
            </Button>
          </div>
        ) : profile ? (
          <>
            <Card className="mb-4">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="h-20 w-20 rounded-full object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary border-2 border-primary/20">
                      {getInitials(profile.full_name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold truncate">{profile.full_name || 'مستخدم مُكتري'}</h2>
                      {profile.verification_badge === 'verified' && <VerifiedBadge size="lg" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {roleLabels[profile.role] || profile.role}
                      </Badge>
                      <RatingDisplay userId={profile.id} variant="full" size="md" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      عضو منذ {memberSince}
                    </p>
                  </div>
                </div>

                {profile.bio && (
                  <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{profile.bio}</p>
                )}

                <div className="flex gap-4 mt-4 pt-4 border-t border-border">
                  {profile.role === 'renter' ? (
                    <>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-accent" />
                        <span className="text-sm font-semibold">{requestsCount}</span>
                        <span className="text-xs text-muted-foreground">طلب</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-accent" />
                        <span className="text-sm font-semibold">{responsesCount}</span>
                        <span className="text-xs text-muted-foreground">رد</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-accent" />
                        <span className="text-sm font-semibold">{listings.length}</span>
                        <span className="text-xs text-muted-foreground">إعلان</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-accent" />
                        <span className="text-sm font-semibold">{profile.total_responses ?? 0}</span>
                        <span className="text-xs text-muted-foreground">رد</span>
                      </div>
                    </>
                  )}
                </div>

                {user && user.id !== id && (
                  <Button
                    onClick={async () => {
                      if (!id || !profile) return;
                      
                      // Check for any existing conversation between these two users
                      const { data: asUser } = await supabase
                        .from('listing_conversations')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('owner_id', id)
                        .limit(1);

                      if (asUser && asUser.length > 0) {
                        navigate(`/chat/${asUser[0].id}`);
                        return;
                      }

                      const { data: asOwner } = await supabase
                        .from('listing_conversations')
                        .select('id')
                        .eq('owner_id', user.id)
                        .eq('user_id', id)
                        .limit(1);

                      if (asOwner && asOwner.length > 0) {
                        navigate(`/chat/${asOwner[0].id}`);
                        return;
                      }
                      
                      // No existing conversation — need a listing to anchor it
                      // RLS requires user_id = auth.uid(), so current user must always be user_id
                      // First try listings owned by either party, then fall back to any active listing
                      const { data: anyListing } = await supabase
                        .from('listings')
                        .select('id')
                        .eq('status', 'active')
                        .limit(1);

                      if (anyListing && anyListing.length > 0) {
                        const { data: created, error } = await supabase
                          .from('listing_conversations')
                          .insert({ listing_id: anyListing[0].id, owner_id: id, user_id: user.id })
                          .select('id')
                          .single();
                        if (created) { navigate(`/chat/${created.id}`); return; }
                        if (error) console.error('Failed to create conversation:', error);
                      }

                      toast.error('لا يمكن بدء محادثة حالياً');
                    }}
                    className="mt-4 w-full rounded-xl py-3"
                  >
                    <MessageSquare className="h-4 w-4 ml-2" />
                    مراسلة
                  </Button>
                )}
              </CardContent>
            </Card>

            {profile.role !== 'renter' && <div className="mb-4">
              <h3 className="text-base font-bold mb-3">الإعلانات النشطة</h3>
              {listings.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="لا توجد إعلانات"
                  subtitle="لم ينشر هذا المستخدم أي إعلان بعد"
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {displayedListings.map((listing: any) => (
                      <ListingCard
                        key={listing.id}
                        id={listing.id}
                        imageUrl={getPrimaryImage(listing)}
                        category={listing.category}
                        price={listing.price}
                        district={listing.district?.name_ar}
                        bedrooms={listing.bedrooms}
                        furnishing={listing.furnishing}
                        createdAt={listing.created_at}
                        ownerId={profile.id}
                        isVerifiedOwner={profile.verification_badge === 'verified'}
                      />
                    ))}
                  </div>
                  {listings.length > 6 && !showAll && (
                    <Button variant="outline" className="w-full mt-3" onClick={() => setShowAll(true)}>
                      عرض الكل ({listings.length})
                    </Button>
                  )}
                </>
              )}
            </div>

            <UserRatingsSection userId={profile.id} userName={profile.full_name || 'المستخدم'} />
          </>
        ) : (
          <EmptyState icon={User} title="المستخدم غير موجود" />
        )}
      </div>

    </div>
  );
};

export default PublicProfilePage;
