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
import { SendHousingOfferDialog } from '@/components/rental/SendHousingOfferDialog';
import { HousingRequestOffersList } from '@/components/rental/HousingRequestOffersList';
import {
  MapPin, MessageSquare, Eye, Users, Calendar, RefreshCw,
  Send, FileQuestion, Clock, CheckCircle2, Wallet, BedDouble, Sofa, FileText, Hash, Home, Gift,
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
  responder_id: string;
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
  const [offerOpen, setOfferOpen] = useState(false);

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
          .select('id, message, created_at, listing_id, responder_id, responder:profiles!request_responses_responder_id_fkey(full_name, avatar_url)')
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

  const openChatWithResponder = async (resp: ResponseRow) => {
    if (!user) {
      navigate(`/auth?returnUrl=/requests/${id}`);
      return;
    }
    if (!request) return;
    if (resp.responder_id === user.id) return;

    // Determine the two parties for the conversation
    const requesterId = request.requester_id;
    const responderId = resp.responder_id;

    // Look for an existing request conversation
    const { data: existing, error: selErr } = await (supabase as any)
      .from('request_conversations')
      .select('id')
      .eq('request_id', request.id)
      .eq('requester_id', requesterId)
      .eq('responder_id', responderId)
      .maybeSingle();

    if (selErr) console.error('request conv select error', selErr);

    if (existing?.id) {
      navigate(`/request-chat/${existing.id}`);
      return;
    }

    const { data: created, error: cErr } = await (supabase as any)
      .from('request_conversations')
      .insert({
        request_id: request.id,
        requester_id: requesterId,
        responder_id: responderId,
      })
      .select('id')
      .single();

    if (cErr || !created) {
      console.error('request conv create error', cErr);
      toast.error('تعذر فتح المحادثة');
      return;
    }

    navigate(`/request-chat/${created.id}`);
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

      <div className="p-5 space-y-6 max-w-lg mx-auto md:max-w-none md:mx-0">
        {/* Main summary card */}
        <Card className="overflow-hidden">
          <CardContent className="p-5 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div
                onClick={() => navigate(`/profile/${request.requester_id}`)}
                className="flex items-center gap-3 cursor-pointer group min-w-0"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground shadow-sm shrink-0">
                  {requesterName.charAt(0)}
                </div>
                <div className="text-right min-w-0">
                  <p className="text-[15px] font-bold text-foreground group-hover:text-primary transition-colors truncate tracking-tight">{requesterName}</p>
                  {request.created_at && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{timeAgo(request.created_at)}</p>
                  )}
                </div>
              </div>
              <Badge className={cn('text-[11px] font-bold rounded-lg px-3 py-1.5 gap-1.5 inline-flex items-center shrink-0', statusColors[request.status ?? 'active'])}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusLabels[request.status ?? 'active']}
              </Badge>
            </div>

            <div className="pt-4 border-t border-border/50 grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-4 w-4 text-primary stroke-[2px]" />
                  <span className="text-[11px] text-muted-foreground">رقم الطلب</span>
                </div>
                <span className="text-[13px] font-bold text-foreground truncate max-w-full" dir="ltr">#{request.id.slice(0, 6)}</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 text-center border-x border-border/50">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary stroke-[2px]" />
                  <span className="text-[11px] text-muted-foreground">تاريخ الإنشاء</span>
                </div>
                <span className="text-[13px] font-bold text-foreground">
                  {request.created_at ? new Date(request.created_at).toLocaleDateString('en-GB') : '—'}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5 text-center">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-primary stroke-[2px]" />
                  <span className="text-[11px] text-muted-foreground">مشاهدات</span>
                </div>
                <span className="text-[13px] font-bold text-foreground">{request.views_count ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section title: معلومات الطلب */}
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <h3 className="text-[15px] font-extrabold text-foreground">معلومات الطلب</h3>
        </div>

        {/* Request info card */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-2">
              {[
                {
                  icon: MapPin,
                  label: 'الموقع',
                  value: (() => {
                    const d = districts.find(d => d.id === request.district_id);
                    const base = d ? (d.city ? `${d.city} • ${d.name_ar}` : d.name_ar) : '—';
                    return `${base}${request.neighborhood ? ` — ${request.neighborhood}` : ''}`;
                  })(),
                  borderL: true, borderB: true,
                },
                {
                  icon: Wallet,
                  label: 'الميزانية',
                  value: budget ?? '—',
                  borderL: false, borderB: true,
                },
                {
                  icon: BedDouble,
                  label: 'عدد الغرف',
                  value: request.bedrooms_needed ? `${request.bedrooms_needed} غرف` : '—',
                  borderL: true, borderB: true,
                },
                {
                  icon: Users,
                  label: 'نوع الطلب',
                  value: request.for_whom ? (forWhomLabels[request.for_whom] ?? request.for_whom) : '—',
                  borderL: false, borderB: true,
                },
                {
                  icon: Sofa,
                  label: 'التأثيث',
                  value: request.furnishing_preference ? furnishingLabels[request.furnishing_preference] : '—',
                  borderL: true, borderB: false,
                },
                {
                  icon: Calendar,
                  label: 'تاريخ الانتقال',
                  value: request.move_in_date ? new Date(request.move_in_date).toLocaleDateString('en-GB') : '—',
                  borderL: false, borderB: false,
                },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-3 p-5 min-w-0',
                      item.borderB && 'border-b border-border/40',
                      item.borderL && 'border-l border-border/40',
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-primary stroke-[2px]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-muted-foreground mb-1 font-normal tracking-tight">{item.label}</p>
                      <p className="text-[13px] font-medium text-foreground truncate tracking-tight">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {request.notes && (
          <>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <h3 className="text-[15px] font-extrabold text-foreground">ملاحظات</h3>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-primary stroke-[2px] mt-0.5" />
                  <p className="text-[13px] text-foreground/85 leading-[1.9] flex-1">{request.notes}</p>
                </div>
              </CardContent>
            </Card>
          </>
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
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center text-[11px] font-bold text-accent shrink-0">
                            {respName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold truncate">{respName}</p>
                            {resp.created_at && <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(resp.created_at)}</p>}
                          </div>
                        </div>
                        <p className="text-[13px] text-foreground leading-[1.7]">{resp.message}</p>
                        {user && resp.responder_id !== user.id && (
                          <div className="mt-3 pt-3 border-t border-border/50 flex justify-end">
                            <button
                              type="button"
                              onClick={() => openChatWithResponder(resp)}
                              aria-label="بدء محادثة"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1.5 text-[12px] font-bold text-accent transition-colors hover:bg-accent/25 active:scale-[0.98]"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              محادثة
                            </button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Housing request offers (visible to requester and the offering owners) */}
        {user && (
          <HousingRequestOffersList housingRequestId={request.id} onChange={fetchData} />
        )}

        {/* Send-offer button for owners/brokers */}
        {user && isOwnerOrBroker && !isRequester && request.status === 'active' && (
          <>
            <Button onClick={() => setOfferOpen(true)} variant="outline" className="w-full gap-2 border-accent/30 text-accent hover:bg-accent/10">
              <Gift className="h-4 w-4" /> إرسال عرض
            </Button>
            <SendHousingOfferDialog
              open={offerOpen}
              onOpenChange={setOfferOpen}
              housingRequestId={request.id}
              requesterId={request.requester_id}
              onSent={fetchData}
            />
          </>
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
