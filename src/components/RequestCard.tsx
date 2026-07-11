import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatPrice, timeAgo } from '@/lib/format';
import { toast } from 'sonner';
import { RatingDisplay } from '@/components/rating/RatingDisplay';
import { FulfillRequestDialog } from '@/components/rental/FulfillRequestDialog';
import {
  MapPin, MessageSquare, Eye, Users, BedDouble, Wallet,
  Home, Clock, CheckCircle2,
} from 'lucide-react';

const categoryLabels: Record<string, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'بيت', floor: 'دور',
  shop: 'محل', office: 'مكتب', shared: 'سكن مشترك', family: 'عائلي', student: 'طلابي',
};

const forWhomLabels: Record<string, string> = {
  family: 'عائلة', bachelors: 'عزاب', students: 'طلاب',
};

const statusLabels: Record<string, string> = {
  active: 'طلب نشط', fulfilled: 'مكتمل', completed: 'مكتمل', expired: 'منتهي', cancelled: 'ملغي',
};
const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  fulfilled: 'bg-primary/10 text-primary border-primary/20',
  completed: 'bg-primary/10 text-primary border-primary/20',
  expired: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

export interface RequestCardData {
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
  responses_count: number | null;
  views_count: number | null;
  status: string | null;
  created_at: string | null;
  expires_at: string | null;
  requester_id: string;
  requester: { full_name: string; avatar_url: string | null } | null;
}

interface RequestCardProps {
  request: RequestCardData;
  districts: { id: string; name_ar: string; city?: string | null }[];
  onFulfilled?: () => void;
  index?: number;
}

export const RequestCard = ({ request: r, districts, onFulfilled, index = 0 }: RequestCardProps) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [chatLoading, setChatLoading] = useState(false);
  const [fulfillOpen, setFulfillOpen] = useState(false);

  const name = (r.requester as any)?.full_name ?? 'مستخدم';
  const avatarUrl = (r.requester as any)?.avatar_url ?? null;
  const initials = name.slice(0, 2);
  const d = districts.find(d => d.id === r.district_id);
  const isOwner = user?.id === r.requester_id;
  const isOwnerOrBroker = profile?.role === 'owner' || profile?.role === 'broker';

  const budget = r.min_price || r.max_price
    ? `${r.min_price ? formatPrice(Number(r.min_price)) : '—'} – ${r.max_price ? formatPrice(Number(r.max_price)) : '—'}`
    : null;

  const handleMessage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { navigate('/auth'); return; }
    if (user.id === r.requester_id) return;
    setChatLoading(true);
    try {
      // Strict request-centric: one request = one unique chat per (requester, responder)
      const { data: existing } = await supabase
        .from('request_conversations')
        .select('id')
        .eq('request_id', r.id)
        .eq('requester_id', r.requester_id)
        .eq('responder_id', user.id)
        .maybeSingle();

      if (existing?.id) {
        navigate(`/request-chat/${existing.id}`);
        return;
      }

      const { data: created, error } = await supabase
        .from('request_conversations')
        .insert({
          request_id: r.id,
          requester_id: r.requester_id,
          responder_id: user.id,
        })
        .select('id')
        .single();

      if (created?.id) {
        navigate(`/request-chat/${created.id}`);
        return;
      }
      if (error) console.error('Failed to create request conversation:', error);
      toast.error('لا يمكن بدء محادثة حالياً');
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <>
    <div
      onClick={() => navigate(`/requests/${r.id}`)}
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
      className="animate-card-in cursor-pointer rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elevated active:scale-[0.99]"
    >
      {/* Header: Avatar + Name + Status */}
      <div className="flex items-center gap-3 mb-4">
        <Avatar className="h-10 w-10 border border-border">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={name} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">
            يبحث عن {categoryLabels[r.category] || r.category}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground truncate">{name}</p>
            <RatingDisplay userId={r.requester_id} variant="compact" />
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn('shrink-0 text-[10px] px-2 py-0.5 border', statusColors[r.status ?? 'active'])}
        >
          {statusLabels[r.status ?? 'active']}
        </Badge>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {d && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="truncate">{d.city ? `${d.city} • ${d.name_ar}` : d.name_ar}{r.neighborhood ? ` — ${r.neighborhood}` : ''}</span>
          </div>
        )}
        {budget && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="truncate">{budget}</span>
          </div>
        )}
        {r.bedrooms_needed && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BedDouble className="h-3.5 w-3.5 text-accent shrink-0" />
            <span>{r.bedrooms_needed} غرف</span>
          </div>
        )}
        {r.for_whom && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-accent shrink-0" />
            <span>{forWhomLabels[r.for_whom] ?? r.for_whom}</span>
          </div>
        )}
      </div>

      {/* Notes */}
      {r.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">{r.notes}</p>
      )}

      {/* Footer stats */}
      <div className="flex items-center gap-4 pt-3 border-t border-border/50 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" /> {r.responses_count ?? 0} رد
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" /> {r.views_count ?? 0}
        </span>
        {r.created_at && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {timeAgo(r.created_at)}
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-3">
        {!isOwner && (
          <Button
            variant="default"
            size="sm"
            className="rounded-xl gap-2 text-xs min-w-[110px]"
            onClick={handleMessage}
            loading={chatLoading}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            مراسلة
          </Button>
        )}
        {isOwner && r.status === 'active' && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-xs border-success/30 text-success hover:bg-success/10"
            onClick={(e) => { e.stopPropagation(); setFulfillOpen(true); }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            تأكيد تنفيذ الطلب
          </Button>
        )}
      </div>

    </div>
    {/* Fulfill Dialog - rendered outside clickable card to avoid click bubbling */}
    {isOwner && (
      <div onClick={(e) => e.stopPropagation()}>
        <FulfillRequestDialog
          open={fulfillOpen}
          onOpenChange={setFulfillOpen}
          requestId={r.id}
          requestCategory={r.category}
          onCompleted={onFulfilled}
        />
      </div>
    )}
    </>
  );
};
