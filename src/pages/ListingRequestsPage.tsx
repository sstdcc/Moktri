import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LoginRequired } from '@/components/ui/LoginRequired';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Inbox, MessageCircle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Status = 'pending' | 'accepted' | 'rejected' | 'cancelled';

interface ListingRequest {
  id: string;
  listing_id: string;
  requester_id: string;
  conversation_id: string | null;
  type: 'request' | 'negotiate';
  message: string | null;
  offered_price: number | null;
  status: Status;
  created_at: string;
  requester?: { full_name: string | null; avatar_url: string | null } | null;
  listing?: { title: string } | null;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const days = Math.floor(h / 24);
  if (days < 30) return `قبل ${days} يوم`;
  return d.toLocaleDateString('ar-EG');
};

export default function ListingRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ListingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status>('pending');
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('listing_requests')
        .select('*, requester:profiles!requester_id(full_name, avatar_url), listing:listings!listing_id(title)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) toast.error('تعذر تحميل الطلبات');
      setItems((data || []) as ListingRequest[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const grouped = useMemo(() => ({
    pending: items.filter(i => i.status === 'pending'),
    accepted: items.filter(i => i.status === 'accepted'),
    rejected: items.filter(i => i.status === 'rejected'),
  }), [items]);

  const updateStatus = async (req: ListingRequest, status: 'accepted' | 'rejected') => {
    setActingId(req.id);
    const { error } = await (supabase as any)
      .from('listing_requests')
      .update({ status })
      .eq('id', req.id);
    if (error) {
      toast.error('حدث خطأ');
      setActingId(null);
      return;
    }
    setItems(prev => prev.map(r => r.id === req.id ? { ...r, status } : r));
    if (status === 'accepted') {
      await supabase
        .from('listings')
        .update({ status: 'negotiating' as any, last_updated_at: new Date().toISOString() })
        .eq('id', req.listing_id);
    }
    await supabase.from('notifications').insert({
      user_id: req.requester_id,
      type: status === 'accepted' ? 'private_offer_accepted' as any : 'private_offer_rejected' as any,
      title_ar: status === 'accepted' ? 'تم قبول طلبك' : 'تم رفض طلبك',
      body_ar: `بشأن: ${req.listing?.title || ''}`,
      link: req.conversation_id ? `/chat/${req.conversation_id}` : `/listings/${req.listing_id}`,
    });
    toast.success(status === 'accepted' ? 'تم القبول — جاري التفاوض' : 'تم الرفض');
    setActingId(null);
  };

  if (authLoading) return <LoadingSpinner />;
  if (!user) return <LoginRequired />;

  const renderList = (list: ListingRequest[]) => {
    if (loading) return <LoadingSpinner />;
    if (list.length === 0) {
      return (
        <EmptyState
          icon={Inbox}
          title="لا توجد طلبات"
          subtitle="لم يتم العثور على أي طلبات في هذه الحالة"
        />
      );
    }
    return (
      <div className="space-y-3">
        {list.map(req => (
          <div key={req.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                {req.requester?.avatar_url ? (
                  <img src={req.requester.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-base font-bold text-primary">{req.requester?.full_name?.charAt(0) || '؟'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => navigate(`/profile/${req.requester_id}`)}
                    className="text-sm font-bold text-foreground truncate hover:text-primary"
                  >
                    {req.requester?.full_name || 'مستخدم'}
                  </button>
                  <span className={cn(
                    'text-[10px] rounded-full px-2 py-0.5 font-bold',
                    req.type === 'negotiate' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'
                  )}>
                    {req.type === 'negotiate' ? 'تفاوض' : 'طلب السكن'}
                  </span>
                  <span className="text-[10px] text-muted-foreground mr-auto">{formatTime(req.created_at)}</span>
                </div>
                <button
                  onClick={() => navigate(`/listings/${req.listing_id}`)}
                  className="block text-xs text-muted-foreground mt-1 truncate hover:text-foreground text-right w-full"
                >
                  {req.listing?.title}
                </button>
                {req.offered_price != null && (
                  <p className="text-xs font-bold text-accent mt-1.5">
                    السعر المقترح: {Number(req.offered_price).toLocaleString('en-GB')} ر.ي
                  </p>
                )}
                {req.message && (
                  <p className="text-xs text-foreground/80 mt-1.5 leading-relaxed">{req.message}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              {req.status === 'pending' && (
                <>
                  <button
                    onClick={() => updateStatus(req, 'accepted')}
                    disabled={actingId === req.id}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-success text-white py-2 text-xs font-bold hover:bg-success/90 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> قبول
                  </button>
                  <button
                    onClick={() => updateStatus(req, 'rejected')}
                    disabled={actingId === req.id}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-danger text-white py-2 text-xs font-bold hover:bg-danger/90 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> رفض
                  </button>
                </>
              )}
              {req.conversation_id && (
                <button
                  onClick={() => navigate(`/chat/${req.conversation_id}`)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-accent text-white py-2 text-xs font-bold hover:bg-accent/90"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> فتح المحادثة
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container max-w-3xl mx-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <Inbox className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-bold text-foreground">الطلبات الواردة</h1>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="pending">قيد الانتظار ({grouped.pending.length})</TabsTrigger>
          <TabsTrigger value="accepted">مقبولة ({grouped.accepted.length})</TabsTrigger>
          <TabsTrigger value="rejected">مرفوضة ({grouped.rejected.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">{renderList(grouped.pending)}</TabsContent>
        <TabsContent value="accepted" className="mt-4">{renderList(grouped.accepted)}</TabsContent>
        <TabsContent value="rejected" className="mt-4">{renderList(grouped.rejected)}</TabsContent>
      </Tabs>
    </div>
  );
}
