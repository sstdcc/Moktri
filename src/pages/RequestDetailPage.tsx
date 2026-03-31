import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDistricts } from '@/contexts/DistrictsContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { BottomNav } from '@/components/ui/BottomNav';
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
import {
  MapPin, MessageSquare, Eye, Users, Calendar, RefreshCw,
  Send, Phone, FileQuestion, Clock,
} from 'lucide-react';

const categoryLabels: Record<string, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'بيت', floor: 'دور',
  shop: 'محل', office: 'مكتب', shared: 'سكن مشترك', family: 'عائلي', student: 'طلابي',
};
const forWhomLabels: Record<string, string> = { family: 'عائلة', bachelors: 'عزاب', students: 'طلاب' };
const furnishingLabels: Record<string, string> = { any: 'أي نوع', furnished: 'مفروش', unfurnished: 'غير مفروش' };
const statusLabels: Record<string, string> = { active: 'نشط', fulfilled: 'مكتمل', expired: 'منتهي', cancelled: 'ملغي' };
const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success', fulfilled: 'bg-primary/10 text-primary',
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
  requester: { full_name: string; avatar_url: string | null; phone: string; whatsapp_number: string | null; verification_badge: string | null } | null;
}

interface ResponseRow {
  id: string;
  message: string;
  contact_phone: string | null;
  contact_whatsapp: string | null;
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
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

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
        .select('*, requester:profiles!housing_requests_requester_id_fkey(full_name, avatar_url, phone, whatsapp_number, verification_badge)')
        .eq('id', id)
        .single();
      if (err || !data) throw err;
      setRequest(data as unknown as RequestData);

      // Fetch responses if requester or responder
      if (user) {
        const { data: resps } = await supabase
          .from('request_responses')
          .select('id, message, contact_phone, contact_whatsapp, created_at, listing_id, responder:profiles!request_responses_responder_id_fkey(full_name, avatar_url)')
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
      contact_phone: contactPhone.trim() || profile?.phone || null,
      contact_whatsapp: profile?.whatsapp_number || null,
    });
    if (err) {
      toast.error('تعذر إرسال الرد');
    } else {
      toast.success('تم إرسال ردك بنجاح');
      setMessage('');
      setContactPhone('');
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
        <BottomNav />
      </div>
    );
  }

  const budget = request.min_price || request.max_price
    ? `${request.min_price ? formatPrice(Number(request.min_price)) : '—'} – ${request.max_price ? formatPrice(Number(request.max_price)) : '—'}`
    : null;

  const requesterName = (request.requester as any)?.full_name ?? 'مستخدم';

  return (
    <div className="min-h-screen bg-background pb-24 font-tajawal" dir="rtl">
      <PageHeader title="تفاصيل الطلب" showBack />

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Status badge */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            يبحث عن {categoryLabels[request.category] || request.category}
          </h2>
          <Badge className={cn('text-xs', statusColors[request.status ?? 'active'])}>
            {statusLabels[request.status ?? 'active']}
          </Badge>
        </div>

        {/* Requester info */}
        <Card>
          <CardContent className="p-4">
            <div
              onClick={() => navigate(`/profile/${request.requester_id}`)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {requesterName.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{requesterName}</p>
                {request.created_at && (
                  <p className="text-[11px] text-muted-foreground">{timeAgo(request.created_at)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {districtName(request.district_id) && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-accent" />
                <span>{(() => { const d = districts.find(d => d.id === request.district_id); return d ? (d.city ? `${d.city} • ${d.name_ar}` : d.name_ar) : ''; })()}{request.neighborhood ? ` — ${request.neighborhood}` : ''}</span>
              </div>
            )}
            {budget && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-accent font-bold">💰</span>
                <span>{budget}</span>
              </div>
            )}
            {request.bedrooms_needed && (
              <div className="flex items-center gap-2 text-sm">
                <span>🛏</span>
                <span>{request.bedrooms_needed} غرف نوم</span>
              </div>
            )}
            {request.for_whom && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-accent" />
                <span>{forWhomLabels[request.for_whom] ?? request.for_whom}</span>
              </div>
            )}
            {request.furnishing_preference && request.furnishing_preference !== 'any' && (
              <div className="flex items-center gap-2 text-sm">
                <span>🛋</span>
                <span>{furnishingLabels[request.furnishing_preference]}</span>
              </div>
            )}
            {request.move_in_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-accent" />
                <span>تاريخ الانتقال: {new Date(request.move_in_date).toLocaleDateString('ar-YE')}</span>
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/50">
              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {request.responses_count ?? 0} رد</span>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {request.views_count ?? 0} مشاهدة</span>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {request.notes && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-bold mb-2">ملاحظات</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{request.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Responses section */}
        {(isRequester || responses.length > 0) && (
          <div>
            <h3 className="text-sm font-bold mb-3">الردود ({responses.length})</h3>
            {responses.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">لم ترد أي ردود بعد</p>
            ) : (
              <div className="space-y-3">
                {responses.map((resp) => {
                  const respName = (resp.responder as any)?.full_name ?? 'مستخدم';
                  return (
                    <Card key={resp.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">
                            {respName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{respName}</p>
                            {resp.created_at && <p className="text-[10px] text-muted-foreground">{timeAgo(resp.created_at)}</p>}
                          </div>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{resp.message}</p>
                        {resp.contact_phone && (
                          <a href={`tel:${resp.contact_phone}`} className="mt-2 inline-flex items-center gap-1 text-xs text-accent">
                            <Phone className="h-3 w-3" /> {resp.contact_phone}
                          </a>
                        )}
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
                  <Input
                    placeholder="رقم التواصل (اختياري)"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    dir="ltr"
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

        {/* Login prompt */}
        {!user && request.status === 'active' && (
          <Button onClick={() => navigate(`/auth?returnUrl=/requests/${id}`)} className="w-full gap-2">
            سجل دخولك للرد على هذا الطلب
          </Button>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default RequestDetailPage;
