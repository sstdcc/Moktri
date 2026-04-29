import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDistricts } from '@/contexts/DistrictsContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { PageHeader } from '@/components/ui/PageHeader';

import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatPrice, timeAgo } from '@/lib/format';
import { toast } from 'sonner';
import { FulfillRequestDialog } from '@/components/rental/FulfillRequestDialog';
import {
  MapPin, MessageSquare, Eye, Users, Calendar, RefreshCw,
  Send, FileQuestion, Clock, CheckCircle2, Wallet, BedDouble, Sofa, StickyNote,
} from 'lucide-react';

const categoryLabels: Record<string, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'بيت', floor: 'دور',
  shop: 'محل', office: 'مكتب', shared: 'سكن مشترك', family: 'عائلي', student: 'طلابي',
};
const forWhomLabels: Record<string, string> = { family: 'عائلة', bachelors: 'عزاب', students: 'طلاب' };
const furnishingLabels: Record<string, string> = { any: 'أي نوع', furnished: 'مفروش', unfurnished: 'غير مفروش' };
const statusLabels: Record<string, string> = { active: 'نشط', fulfilled: 'مكتمل', completed: 'مكتمل', expired: 'منتهي', cancelled: 'ملغي' };
const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success', fulfilled: 'bg-primary/10 text-primary', completed: 'bg-primary/10 text-primary',
  expired: 'bg-muted text-muted-foreground', cancelled: 'bg-destructive/10 text-destructive',
};

interface RequestData {
  id: string;
  category: string;
  neighborhood: string | null;
  district_id: string | null;
  min_price: number | null;
  max_price: number | null;
  currency: string | null;
  for_whom: string | null;
  notes: string | null;
  bedrooms_needed: number | null;
  furnishing_preference: string | null;
  move_in_date: string | null;
  responses_count: number | null;
  views_count: number | null;
  status: string | null;
  created_at: string | null;
  expires_at: string | null;
  requester_id: string;
  requester: { full_name: string; avatar_url: string | null; verification_badge: string | null } | null;
}

interface ResponseRow {
  id: string;
  message: string;
  created_at: string | null;
  listing_id: string | null;
  responder: { full_name: string; avatar_url: string | null } | null;
}

const RequestDetailPage = () => {
  usePageTitle();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { districts } = useDistricts();

  const [request, setRequest] = useState<RequestData | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Response form
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [fulfillOpen, setFulfillOpen] = useState(false);

  const districtName = (dId: string | null) => districts.find(d => d.id === dId)?.name_ar ?? '';

  const isOwnerOrBroker = profile?.role === 'owner' || profile?.role === 'broker';
  const isRequester = user?.id === request?.requester_id;

  const fetchData = useCallback(async () => {
    if (!id) return;
    setError(false);
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('housing_requests')
        .select('*, requester:profiles!housing_requests_requester_id_fkey(full_name, avatar_url, verification_badge)')
        .eq('id', id)
        .single();
      if (err || !data) throw err;
      setRequest(data as unknown as RequestData);

      // Fetch responses if requester or responder
      if (user) {
        const { data: resps } = await supabase
          .from('request_responses')
          .select('id, message, created_at, listing_id, responder:profiles!request_responses_responder_id_fkey(full_name, avatar_url)')
          .eq('request_id', id)
          .order('created_at', { ascending: false });
        setResponses((resps as unknown as ResponseRow[]) ?? []);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmitResponse = async () => {
    if (!user || !id || !message.trim()) return;
    setSubmitting(true);
    const { error: err } = await supabase.from('request_responses').insert({
      request_id: id,
      responder_id: user.id,
      message: message.trim(),
      // Contact details intentionally omitted — communication happens via in-app chat only.
    });
    if (err) {
      toast.error('تعذر إرسال الرد');
    } else {
      toast.success('تم إرسال ردك بنجاح');
      setMessage('');
      setShowForm(false);
      fetchData();
    }
    setSubmitting(false);
  };

  if (loading) return <LoadingSpinner />;

  if (error || !request) {
    return (
      <div className="min-h-screen bg-background font-tajawal" dir="rtl">
        <PageHeader title="تفاصيل الطلب" showBack />
        <div className="flex flex-col items-center gap-3 py-16">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error ? 'تعذر تحميل الطلب' : 'الطلب غير موجود'}</p>
          {error && (
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 ml-2" /> إعادة المحاولة
            </Button>
          )}
        </div>
        
      </div>
    );
  }

  const budget = request.min_price || request.max_price
    ? `${request.min_price ? formatPrice(Number(request.min_price)) : '—'} – ${request.max_price ? formatPrice(Number(request.max_price)) : '—'}`
    : null;

  const requesterName = (request.requester as any)?.full_name ?? 'مستخدم';

  return (
    <div className="min-h-screen bg-background pb-28 font-tajawal" dir="rtl">
      <PageHeader title="تفاصيل الطلب" showBack />

      <div className="p-5 space-y-5 max-w-lg mx-auto">
        {/* Status badge */}
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-extrabold text-foreground tracking-tight">
            يبحث عن {categoryLabels[request.category] || request.category}
          </h2>
          <Badge className={cn('text-[11px] font-bold rounded-lg px-3 py-1', statusColors[request.status ?? 'active'])}>
            {statusLabels[request.status ?? 'active']}
          </Badge>
        </div>

        {/* Requester info */}
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div
              onClick={() => navigate(`/profile/${request.requester_id}`)}
              className="flex items-center gap-3.5 cursor-pointer group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-bold text-primary shadow-sm">
                {requesterName.charAt(0)}
              </div>
              <div>
                <p className="text-[14px] font-bold text-foreground group-hover:text-primary transition-colors">{requesterName}</p>
                {request.created_at && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(request.created_at)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
              {districtName(request.district_id) && (
                <div className="flex items-center justify-start gap-2 text-[13px] min-w-0">
                  <MapPin className="h-4 w-4 shrink-0 text-primary stroke-[2px]" />
                  <span className="text-foreground/80 truncate">{(() => { const d = districts.find(d => d.id === request.district_id); return d ? (d.city ? `${d.city} • ${d.name_ar}` : d.name_ar) : ''; })()}{request.neighborhood ? ` — ${request.neighborhood}` : ''}</span>
                </div>
              )}
              {budget && (
                <div className="flex items-center justify-start gap-2 text-[13px] min-w-0">
                  <Wallet className="h-4 w-4 shrink-0 text-primary stroke-[2px]" />
                  <span className="font-semibold text-foreground truncate">{budget}</span>
                </div>
              )}
              {request.bedrooms_needed && (
                <div className="flex items-center justify-start gap-2 text-[13px] min-w-0">
                  <BedDouble className="h-4 w-4 shrink-0 text-primary stroke-[2px]" />
                  <span className="text-foreground/80 truncate">{request.bedrooms_needed} غرف نوم</span>
                </div>
              )}
              {request.for_whom && (
                <div className="flex items-center justify-start gap-2 text-[13px] min-w-0">
                  <Users className="h-4 w-4 shrink-0 text-primary stroke-[2px]" />
                  <span className="text-foreground/80 truncate">{forWhomLabels[request.for_whom] ?? request.for_whom}</span>
                </div>
              )}
              {request.furnishing_preference && request.furnishing_preference !== 'any' && (
                <div className="flex items-center justify-start gap-2 text-[13px] min-w-0">
                  <Sofa className="h-4 w-4 shrink-0 text-primary stroke-[2px]" />
                  <span className="text-foreground/80 truncate">{furnishingLabels[request.furnishing_preference]}</span>
                </div>
              )}
              {request.move_in_date && (
                <div className="flex items-center justify-start gap-2 text-[13px] min-w-0">
                  <Calendar className="h-4 w-4 shrink-0 text-primary stroke-[2px]" />
                  <span className="text-foreground/80 truncate">تاريخ الانتقال: {new Date(request.move_in_date).toLocaleDateString('ar-YE')}</span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 stroke-[1.8px]" /> {request.responses_count ?? 0} رد</span>
              <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 stroke-[1.8px]" /> {request.views_count ?? 0} مشاهدة</span>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {request.notes && (
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <h3 className="text-[13px] font-bold mb-2.5 text-foreground flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-primary stroke-[2px]" />
                ملاحظات
              </h3>
              <p className="text-[13px] text-muted-foreground leading-[1.8]">{request.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Responses section */}
        {(isRequester || responses.length > 0) && (
          <div>
            <h3 className="text-[14px] font-bold mb-4 text-foreground">الردود ({responses.length})</h3>
            {responses.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-6">لم ترد أي ردود بعد</p>
            ) : (
              <div className="space-y-3">
                {responses.map((resp) => {
                  const respName = (resp.responder as any)?.full_name ?? 'مستخدم';
                  return (
                    <Card key={resp.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center text-[11px] font-bold text-accent">
                            {respName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold truncate">{respName}</p>
                            {resp.created_at && <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(resp.created_at)}</p>}
                          </div>
                        </div>
                        <p className="text-[13px] text-foreground leading-[1.7]">{resp.message}</p>

                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Response form for owners/brokers */}
        {user && isOwnerOrBroker && !isRequester && request.status === 'active' && (
          <>
            {!showForm ? (
              <Button onClick={() => setShowForm(true)} className="w-full gap-2">
                <Send className="h-4 w-4" /> أرسل رداً
              </Button>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-bold">إرسال رد</h3>
                  <Textarea
                    placeholder="اكتب رسالتك للباحث عن سكن..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSubmitResponse} disabled={submitting || !message.trim()} className="flex-1 gap-1">
                      <Send className="h-4 w-4" /> {submitting ? 'جاري الإرسال...' : 'إرسال'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Fulfill action for requester */}
        {isRequester && request.status === 'active' && (
          <>
            <Button
              onClick={() => setFulfillOpen(true)}
              variant="outline"
              className="w-full gap-2 border-success/30 text-success hover:bg-success/10"
            >
              <CheckCircle2 className="h-4 w-4" />
              تأكيد تنفيذ الطلب
            </Button>
            <FulfillRequestDialog
              open={fulfillOpen}
              onOpenChange={setFulfillOpen}
              requestId={request.id}
              requestCategory={request.category}
              onCompleted={fetchData}
            />
          </>
        )}

        {/* Login prompt */}
        {!user && request.status === 'active' && (
          <Button onClick={() => navigate(`/auth?returnUrl=/requests/${id}`)} className="w-full gap-2">
            سجل دخولك للرد على هذا الطلب
          </Button>
        )}
      </div>

    </div>
  );
};

export default RequestDetailPage;
