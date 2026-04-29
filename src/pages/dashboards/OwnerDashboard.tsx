import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle, Eye, Phone, Plus, MoreVertical, AlertTriangle, Heart, Clock, Shield } from 'lucide-react';
import ProfileCompletionCard from '@/components/ProfileCompletionCard';
import SmartNudgeBanner from '@/components/SmartNudgeBanner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';

import { MiftahBadge } from '@/components/ui/MiftahBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MarkAsRentedDialog } from '@/components/rental/MarkAsRentedDialog';
import { PendingRatings } from '@/components/rating/PendingRatings';
import { cn } from '@/lib/utils';
import type { Listing } from '@/types/database';

const statusTabs = [
  { value: 'all', label: 'الكل' },
  { value: 'active', label: 'نشط' },
  { value: 'reserved', label: 'بانتظار التأكيد' },
  { value: 'private_offer', label: 'عرض خاص' },
  { value: 'paused', label: 'موقوف' },
  { value: 'rented', label: 'مؤجر' },
  { value: 'draft', label: 'مسودة' },
  { value: 'pending_review', label: 'معلق' },
  { value: 'expired', label: 'منتهي' },
];

const statusBadgeMap: Record<string, any> = {
  active: 'active', paused: 'pending', rented: 'rented', draft: 'expired',
  pending_review: 'pending', expired: 'expired', rejected: 'rejected',
  private_offer: 'pending', reserved: 'pending',
};

const statusLabelOverride: Record<string, string> = {
  private_offer: 'عرض خاص — بانتظار رد المستأجر',
  reserved: 'بانتظار تأكيد التسليم',
};

interface ListingWithImage extends Listing {
  listing_images: { url: string; is_primary: boolean | null }[];
}

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [listings, setListings] = useState<ListingWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [stats, setStats] = useState({ total: 0, active: 0, views: 0, clicks: 0 });
  const [rentDialog, setRentDialog] = useState<{ open: boolean; listingId: string; title: string; reservedRenterId?: string | null }>({ open: false, listingId: '', title: '', reservedRenterId: null });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Stats
      const { data: allListings } = await supabase
        .from('listings')
        .select('status, views_count, contact_clicks, whatsapp_clicks')
        .eq('owner_id', user.id);
      
      if (allListings) {
        setStats({
          total: allListings.length,
          active: allListings.filter(l => l.status === 'active').length,
          views: allListings.reduce((s, l) => s + (l.views_count || 0), 0),
          clicks: allListings.reduce((s, l) => s + (l.contact_clicks || 0) + (l.whatsapp_clicks || 0), 0),
        });
      }

      // Listings with images
      const { data } = await supabase
        .from('listings')
        .select('*, listing_images(url, is_primary)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setListings(data as unknown as ListingWithImage[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const filteredListings = activeTab === 'all' ? listings : listings.filter(l => l.status === activeTab);

  const staleListings = listings.filter(l => {
    if (l.status !== 'active' || !l.last_updated_at) return false;
    return (Date.now() - new Date(l.last_updated_at).getTime()) > 45 * 86400000;
  });

  const handleAction = async (listingId: string, action: string, title?: string) => {
    if (action === 'edit') { navigate(`/listings/${listingId}/edit`); return; }
    if (action === 'rented') {
      const l = listings.find(x => x.id === listingId);
      setRentDialog({ open: true, listingId, title: title || '', reservedRenterId: (l as any)?.reserved_for_user_id || null });
      return;
    }
    const statusMap: Record<string, string> = { pause: 'paused', renew: 'active' };
    const newStatus = statusMap[action];
    if (newStatus) {
      await supabase.from('listings').update({ status: newStatus as any, last_updated_at: new Date().toISOString() }).eq('id', listingId);
      setListings(prev => prev.map(l => l.id === listingId ? { ...l, status: newStatus as any, last_updated_at: new Date().toISOString() } : l));
    }
  };

  const getPrimaryImage = (l: ListingWithImage) => l.listing_images?.find(i => i.is_primary)?.url || l.listing_images?.[0]?.url;

  const getTimeAgo = (date: string) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (days === 0) return 'اليوم';
    if (days <= 10) return `منذ ${days} أيام`;
    return `منذ ${days} يوم`;
  };

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (loading) return <LoadingSpinner />;

  const statCards = [
    { label: 'إجمالي الإعلانات', value: stats.total, icon: Building2, color: 'text-accent' },
    { label: 'إعلانات نشطة', value: stats.active, icon: CheckCircle, color: 'text-success' },
    { label: 'إجمالي المشاهدات', value: stats.views, icon: Eye, color: 'text-primary' },
    { label: 'نقرات التواصل', value: stats.clicks, icon: Phone, color: 'text-[hsl(270,50%,50%)]' },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 font-tajawal">
      <PageHeader title="لوحة التحكم" />

      <div className="px-4 pt-4">
        {/* Header */}
        <h1 className="text-2xl font-black text-foreground">مرحباً، {profile?.full_name}</h1>
        <p className="text-xs text-muted-foreground mt-1">{today}</p>

        <SmartNudgeBanner />
        <ProfileCompletionCard />
        <PendingRatings />

        {/* Verification banner */}
        {!profile?.is_verified && (
          <button onClick={() => navigate('/verify')}
            className="mt-3 w-full flex items-center gap-2 rounded-2xl bg-accent/10 border border-accent/30 px-4 py-3 transition-all duration-200 hover:bg-accent/20">
            <Shield className="h-5 w-5 text-accent" />
            <div className="flex-1 text-right">
              <span className="text-sm font-bold text-accent">وثّق حسابك لزيادة المصداقية</span>
            </div>
            <span className="text-xs text-accent font-medium">تقدم الآن ←</span>
          </button>
        )}

        {/* Stale listings alert */}
        {staleListings.length > 0 && (
          <div className="mt-3 rounded-2xl bg-accent/10 border border-accent/30 px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-accent font-medium">لديك {staleListings.length} إعلان لم يُحدَّث منذ أكثر من 45 يوماً</p>
              <p className="text-xs text-accent/70 mt-0.5">المستأجرون يفضلون الإعلانات المحدّثة</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-3 overflow-x-auto mt-4 pb-1 scrollbar-hide">
          {statCards.map(s => (
            <div key={s.label} className="min-w-[140px] rounded-2xl border border-border bg-card p-4 shadow-sm shrink-0">
              <s.icon className={cn('h-6 w-6 mb-2', s.color)} />
              <p className="text-2xl font-black text-foreground">{s.value.toLocaleString('en-GB')}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto mt-6 pb-1 scrollbar-hide">
          {statusTabs.map(tab => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
              className={cn('shrink-0 rounded-xl px-4 py-2 text-xs font-medium transition-all duration-200',
                activeTab === tab.value ? 'bg-accent text-white' : 'bg-muted text-muted-foreground')}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Listings */}
        <div className="mt-4 space-y-3">
          {filteredListings.length === 0 ? (
            <EmptyState icon={Building2} title="لا توجد إعلانات" subtitle={activeTab === 'all' ? 'أضف إعلانك الأول الآن' : `لا توجد إعلانات بحالة "${statusTabs.find(t => t.value === activeTab)?.label}"`}
              actionLabel="إضافة إعلان" onAction={() => navigate('/listings/new')} />
          ) : (
            filteredListings.map(l => {
              const imgUrl = getPrimaryImage(l);
              const isStale = l.status === 'active' && l.last_updated_at && (Date.now() - new Date(l.last_updated_at).getTime()) > 30 * 86400000;
              return (
                <div key={l.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-all duration-200 hover:shadow-md">
                  {/* Thumbnail */}
                  <div className="w-[72px] h-[72px] rounded-xl overflow-hidden shrink-0 bg-muted">
                    {imgUrl ? <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                      : <div className="h-full w-full flex items-center justify-center"><Building2 className="h-6 w-6 text-muted-foreground" /></div>}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-semibold text-foreground line-clamp-1">{l.title}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded-lg hover:bg-muted transition-all duration-200">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="font-tajawal">
                          {l.status === 'reserved' && (
                            <DropdownMenuItem onClick={() => handleAction(l.id, 'rented', l.title)} className="text-success font-bold">
                              تأكيد التسليم (تم الإيجار)
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleAction(l.id, 'edit')}>تعديل</DropdownMenuItem>
                          {l.status === 'active' && <DropdownMenuItem onClick={() => handleAction(l.id, 'pause')}>إيقاف</DropdownMenuItem>}
                          {l.status !== 'active' && l.status !== 'reserved' && l.status !== 'private_offer' && <DropdownMenuItem onClick={() => handleAction(l.id, 'renew')}>تجديد</DropdownMenuItem>}
                          {l.status !== 'reserved' && <DropdownMenuItem onClick={() => handleAction(l.id, 'rented', l.title)}>تعيين كمؤجر</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-sm font-bold text-accent mt-0.5">{Number(l.price).toLocaleString('en-GB')} {l.currency === 'YER' ? 'ر.ي' : '$'}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <MiftahBadge variant={statusBadgeMap[l.status || 'draft'] || 'expired'} />
                      {statusLabelOverride[l.status || ''] && (
                        <span className="text-[10px] text-accent font-bold">{statusLabelOverride[l.status || '']}</span>
                      )}
                      {isStale && <span className="text-[10px] text-accent font-medium">⚠ يحتاج تحديث</span>}
                    </div>
                    {l.status === 'reserved' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAction(l.id, 'rented', l.title); }}
                        className="mt-2 w-full text-xs font-bold rounded-lg bg-success text-white px-3 py-2 hover:bg-success/90 transition-all flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        تأكيد التسليم — تم الإيجار
                      </button>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{l.views_count || 0}</span>
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{l.favorites_count || 0}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{getTimeAgo(l.created_at || '')}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* FAB */}
      {(profile?.role === 'owner' || profile?.role === 'broker') && (
        <button onClick={() => navigate('/listings/new')}
          className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-full bg-accent px-5 py-3.5 shadow-lg shadow-accent/30 text-white font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95">
          <Plus className="h-5 w-5" />
          إضافة إعلان
        </button>
      )}

      <MarkAsRentedDialog
        open={rentDialog.open}
        onOpenChange={(o) => setRentDialog(prev => ({ ...prev, open: o }))}
        listingId={rentDialog.listingId}
        listingTitle={rentDialog.title}
        reservedRenterId={rentDialog.reservedRenterId || undefined}
        onCompleted={() => {
          setListings(prev => prev.map(l => l.id === rentDialog.listingId ? { ...l, status: 'rented' as any, last_updated_at: new Date().toISOString() } : l));
        }}
      />
    </div>
  );
};

export default OwnerDashboard;
