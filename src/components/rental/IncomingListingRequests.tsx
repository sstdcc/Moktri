import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, Check, X, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { createNotificationService } from '@/services';
import { cn } from '@/lib/utils';

interface IncomingRequest {
  id: string;
  listing_id: string;
  requester_id: string;
  conversation_id: string | null;
  type: 'request' | 'negotiate';
  message: string | null;
  offered_price: number | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  requester?: { full_name: string | null; avatar_url: string | null } | null;
  listing?: { title: string } | null;
}

export const IncomingListingRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Simple query without embedded joins: no FK is declared between
      // listing_requests and profiles/listings, so PostgREST embeds fail
      // (same reason ListingRequestsPage enriches manually).
      const { data, error } = await supabase
        .from('listing_requests')
        .select('*')
        .eq('owner_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('listing_requests fetch failed:', error);
        setRequests([]);
        setLoading(false);
        return;
      }
      const rows = (data || []) as unknown as IncomingRequest[];

      const requesterIds = Array.from(new Set(rows.map(r => r.requester_id).filter(Boolean)));
      const listingIds = Array.from(new Set(rows.map(r => r.listing_id).filter(Boolean)));

      const [profilesRes, listingsRes] = await Promise.all([
        requesterIds.length
          ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', requesterIds)
          : Promise.resolve({ data: [] } as { data: { id: string; full_name: string | null; avatar_url: string | null }[] }),
        listingIds.length
          ? supabase.from('listings').select('id, title').in('id', listingIds)
          : Promise.resolve({ data: [] } as { data: { id: string; title: string }[] }),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
      const listingMap = new Map((listingsRes.data || []).map(l => [l.id, l]));

      setRequests(rows.map(r => ({
        ...r,
        requester: profileMap.get(r.requester_id) || null,
        listing: listingMap.get(r.listing_id) || null,
      })));
      setLoading(false);
    };
    load();
  }, [user]);

  const updateStatus = async (req: IncomingRequest, status: 'accepted' | 'rejected') => {
    setActingId(req.id);
    // Accept is atomic via RPC (single accepted tenant per listing, auto-rejects others).
    const { error } = status === 'accepted'
      ? await supabase.rpc('accept_listing_request' as any, { _request_id: req.id })
      : await (supabase as any)
          .from('listing_requests')
          .update({ status })
          .eq('id', req.id);
    if (error) {
      toast.error(error.message || 'حدث خطأ');
      setActingId(null);
      return;
    } else {
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status } : r));
      // listings.status → negotiating is now handled atomically inside accept_listing_request RPC

      // Notify requester
      const notifType = status === 'accepted' ? 'private_offer_accepted' : 'private_offer_rejected';
      createNotificationService(supabase).create(notifType, req.requester_id, {
        titleAr: status === 'accepted' ? 'تم قبول طلبك' : 'تم رفض طلبك',
        bodyAr: `بشأن: ${req.listing?.title || ''}`,
        link: req.conversation_id ? `/chat/${req.conversation_id}` : `/listings/${req.listing_id}`,
      }).catch(console.error);
      toast.success(status === 'accepted' ? 'تم القبول — جاري التفاوض' : 'تم الرفض');
    }
    setActingId(null);
  };

  const pending = requests.filter(r => r.status === 'pending');

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-bold text-foreground">الطلبات الواردة</h2>
      </div>
      <p className="mb-3 text-xs font-bold text-muted-foreground">عدد الطلبات: {requests.length}</p>
      {loading && (
        <p className="text-sm text-muted-foreground">جاري تحميل الطلبات...</p>
      )}
      {!loading && pending.length === 0 && (
        <p className="text-sm text-muted-foreground">لا توجد طلبات واردة</p>
      )}
      <div className="space-y-2">
        {pending.map(req => (
          <div key={req.id} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => navigate(`/profile/${req.requester_id}`)}
                className="h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center active:opacity-70"
                aria-label="عرض الملف الشخصي"
              >
                {req.requester?.avatar_url ? (
                  <img src={req.requester.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-primary">{req.requester?.full_name?.charAt(0) || '؟'}</span>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => navigate(`/profile/${req.requester_id}`)}
                    className="text-sm font-bold text-foreground truncate hover:underline text-right"
                  >
                    {req.requester?.full_name || 'مستخدم'}
                  </button>
                  <span className={cn(
                    'text-[10px] rounded-full px-2 py-0.5 font-bold',
                    req.type === 'negotiate' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'
                  )}>
                    {req.type === 'negotiate' ? 'تفاوض' : 'طلب سكن'}
                  </span>
                  {req.status !== 'pending' && (
                    <span className={cn(
                      'text-[10px] rounded-full px-2 py-0.5 font-bold',
                      req.status === 'accepted' ? 'bg-success/10 text-success' :
                      req.status === 'rejected' ? 'bg-danger/10 text-danger' : 'bg-muted text-muted-foreground'
                    )}>
                      {req.status === 'accepted' ? 'مقبول' : req.status === 'rejected' ? 'مرفوض' : 'ملغي'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{req.listing?.title}</p>
                {req.offered_price != null && (
                  <p className="text-xs font-bold text-accent mt-1">
                    السعر المقترح: {Number(req.offered_price).toLocaleString('en-GB')} ر.ي
                  </p>
                )}
                {req.message && (
                  <p className="text-xs text-foreground/80 mt-1 line-clamp-2">{req.message}</p>
                )}
              </div>
            </div>

            {req.status === 'pending' && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => updateStatus(req, 'accepted')}
                  disabled={actingId === req.id}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-success text-white py-2 text-xs font-bold hover:bg-success/90 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> قبول التفاوض
                </button>
                <button
                  onClick={() => updateStatus(req, 'rejected')}
                  disabled={actingId === req.id}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-danger text-white py-2 text-xs font-bold hover:bg-danger/90 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> رفض
                </button>
                {req.conversation_id && (
                  <button
                    onClick={() => navigate(`/chat/${req.conversation_id}`)}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-accent text-white py-2 text-xs font-bold hover:bg-accent/90"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> محادثة
                  </button>
                )}
              </div>
            )}
            {req.status !== 'pending' && req.conversation_id && (
              <button
                onClick={() => navigate(`/chat/${req.conversation_id}`)}
                className="mt-2 w-full flex items-center justify-center gap-1 rounded-lg bg-muted text-foreground py-2 text-xs font-bold hover:bg-muted/80"
              >
                <MessageCircle className="h-3.5 w-3.5" /> فتح المحادثة
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
