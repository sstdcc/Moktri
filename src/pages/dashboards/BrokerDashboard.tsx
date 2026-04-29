import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle, Eye, Phone, MessageSquare, Plus, MoreVertical, AlertTriangle, Heart, Clock, Shield, ArrowLeft, Crown, Users, Home as HomeIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';

import { MiftahBadge } from '@/components/ui/MiftahBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Listing, HousingRequest } from '@/types/database';

const statusTabs = [
  { value: 'all', label: 'الكل' },
  { value: 'active', label: 'نشط' },
  { value: 'paused', label: 'موقوف' },
  { value: 'rented', label: 'مؤجر' },
  { value: 'draft', label: 'مسودة' },
  { value: 'pending_review', label: 'معلق' },
  { value: 'expired', label: 'منتهي' },
];

const statusBadgeMap: Record<string, any> = {
  active: 'active', paused: 'pending', rented: 'rented', draft: 'expired',
  pending_review: 'pending', expired: 'expired', rejected: 'rejected',
};

const categoryLabels: Record<string, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'منزل', floor: 'دور', shop: 'محل',
  office: 'مكتب', shared: 'مشترك', family: 'عائلي', student: 'طلاب',
};

const forWhomLabels: Record<string, string> = { family: 'عائلة', bachelors: 'عزاب', students: 'طلاب' };

interface ListingWithImage extends Listing {
  listing_images: { url: string; is_primary: boolean | null }[];
}

interface RequestWithDistrict extends HousingRequest {
  districts: { name_ar: string } | null;
}

const BrokerDashboard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [listings, setListings] = useState<ListingWithImage[]>([]);
  const [requests, setRequests] = useState<RequestWithDistrict[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [stats, setStats] = useState({ total: 0, active: 0, views: 0, clicks: 0, responses: 0 });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Stats
      const { data: allListings } = await supabase.from('listings').select('status, views_count, contact_clicks, whatsapp_clicks').eq('owner_id', user.id);
      const { count: responsesCount } = await supabase.from('request_responses').select('*', { count: 'exact', head: true }).eq('responder_id', user.id);

      if (allListings) {
        setStats({
          total: allListings.length,
          active: allListings.filter(l => l.status === 'active').length,
          views: allListings.reduce((s, l) => s + (l.views_count || 0), 0),
          clicks: allListings.reduce((s, l) => s + (l.contact_clicks || 0) + (l.whatsapp_clicks || 0), 0),
          responses: responsesCount || 0,
        });
      }

      // Listings
      const { data } = await supabase.from('listings').select('*, listing_images(url, is_primary)').eq('owner_id', user.id).order('created_at', { ascending: false });
      if (data) setListings(data as unknown as ListingWithImage[]);

      // Housing requests
      const { data: reqs } = await supabase.from('housing_requests').select('*, districts(name_ar)').eq('status', 'active').order('created_at', { ascending: false }).limit(5);
      if (reqs) setRequests(reqs as unknown as RequestWithDistrict[]);

      setLoading(false);
    };
    load();
  }, [user]);

  const filteredListings = activeTab === 'all' ? listings : listings.filter(l => l.status === activeTab);
  const getPrimaryImage = (l: ListingWithImage) => l.listing_images?.find(i => i.is_primary)?.url || l.listing_images?.[0]?.url;

  const getTimeAgo = (date: string) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (days === 0) return 'اليوم';
    if (days <= 10) return `منذ ${days} أيام`;
    return `منذ ${days} يوم`;
  };

  const handleAction = async (listingId: string, action: string) => {
    if (action === 'edit') { navigate(`/listings/${listingId}/edit`); return; }
    const statusMap: Record<string, string> = { pause: 'paused', rented: 'rented', renew: 'active' };
    const newStatus = statusMap[action];
    if (newStatus) {
      await supabase.from('listings').update({ status: newStatus as any, last_updated_at: new Date().toISOString() }).eq('id', listingId);
      setListings(prev => prev.map(l => l.id === listingId ? { ...l, status: newStatus as any } : l));
    }
  };

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (loading) return <LoadingSpinner />;

  const statCards = [
    { label: 'إجمالي الإعلانات', value: stats.total, icon: Building2, color: 'text-accent' },
    { label: 'إعلانات نشطة', value: stats.active, icon: CheckCircle, color: 'text-success' },
    { label: 'إجمالي المشاهدات', value: stats.views, icon: Eye, color: 'text-primary' },
    { label: 'نقرات التواصل', value: stats.clicks, icon: Phone, color: 'text-[hsl(270,50%,50%)]' },
    { label: 'ردود على الطلبات', value: stats.responses, icon: MessageSquare, color: 'text-accent' },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 font-tajawal">
      <PageHeader title="لوحة الوسيط" />

      <div className="px-4 pt-4">
        <h1 className="text-2xl font-black text-foreground">مرحباً، {profile?.full_name}</h1>
        <p className="text-xs text-muted-foreground mt-1">{today}</p>

        {!profile?.is_verified && (
          <button onClick={() => navigate('/verify')}
            className="mt-3 w-full flex items-center gap-2 rounded-2xl bg-accent/10 border border-accent/30 px-4 py-3 transition-all duration-200 hover:bg-accent/20">
            <Shield className="h-5 w-5 text-accent" />
            <span className="flex-1 text-right text-sm font-bold text-accent">وثّق حسابك لزيادة المصداقية</span>
            <span className="text-xs text-accent font-medium">تقدم الآن ←</span>
          </button>
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
            <EmptyState icon={Building2} title="لا توجد إعلانات" subtitle="أضف إعلانك الأول الآن" actionLabel="إضافة إعلان" onAction={() => navigate('/listings/new')} />
          ) : (
            filteredListings.map(l => {
              const imgUrl = getPrimaryImage(l);
              return (
                <div key={l.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-all duration-200 hover:shadow-md">
                  <div className="w-[72px] h-[72px] rounded-xl overflow-hidden shrink-0 bg-muted">
                    {imgUrl ? <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                      : <div className="h-full w-full flex items-center justify-center"><Building2 className="h-6 w-6 text-muted-foreground" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-semibold text-foreground line-clamp-1">{l.title}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded-lg hover:bg-muted transition-all duration-200"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="font-tajawal">
                          <DropdownMenuItem onClick={() => handleAction(l.id, 'edit')}>تعديل</DropdownMenuItem>
                          {l.status === 'active' && <DropdownMenuItem onClick={() => handleAction(l.id, 'pause')}>إيقاف</DropdownMenuItem>}
                          {l.status !== 'active' && <DropdownMenuItem onClick={() => handleAction(l.id, 'renew')}>تجديد</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => handleAction(l.id, 'rented')}>تعيين كمؤجر</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-sm font-bold text-accent mt-0.5">{Number(l.price).toLocaleString('en-GB')} ر.ي</p>
                    <div className="flex items-center gap-2 mt-1">
                      <MiftahBadge variant={statusBadgeMap[l.status || 'draft'] || 'expired'} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{l.views_count || 0}</span>
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{l.favorites_count || 0}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Housing Requests */}
        <div className="mt-8">
          <SectionTitle title="طلبات السكن الجديدة" action={{ label: 'عرض الكل', href: '/requests' }} />
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد طلبات جديدة</p>
          ) : (
            <div className="space-y-3">
              {requests.map(r => (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <HomeIcon className="h-4 w-4 text-accent" />
                    <span className="text-sm font-semibold text-foreground">يبحث عن {categoryLabels[r.category] || r.category}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                    {r.districts?.name_ar && <span>📍 {r.districts.name_ar}</span>}
                    {(r.min_price || r.max_price) && (
                      <span>{r.min_price ? Number(r.min_price).toLocaleString('en-GB') : '0'} - {r.max_price ? Number(r.max_price).toLocaleString('en-GB') : '∞'} ريال</span>
                    )}
                    {r.for_whom && <MiftahBadge variant="active" className="!text-[10px]" />}
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{r.responses_count || 0} رد</span>
                    <span>{getTimeAgo(r.created_at || '')}</span>
                  </div>
                  <Button size="sm" className="mt-3 gap-1" onClick={() => navigate(`/requests/${r.id}`)}>
                    الرد على الطلب <ArrowLeft className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subscription card */}
        <div className="mt-8 rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-bold text-foreground">الباقة الحالية: مجاني</h3>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground mb-4">
            <li>• نشر حتى 5 إعلانات</li>
            <li>• الرد على طلبات السكن</li>
            <li>• ملف شخصي أساسي</li>
          </ul>
          <Button className="w-full gap-2">
            <Crown className="h-4 w-4" /> ترقية للباقة الاحترافية
          </Button>
        </div>
      </div>

      {/* FAB */}
      <button onClick={() => navigate('/listings/new')}
        className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-full bg-accent px-5 py-3.5 shadow-lg shadow-accent/30 text-white font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95">
        <Plus className="h-5 w-5" />
        إضافة إعلان
      </button>

      
    </div>
  );
};

export default BrokerDashboard;
