import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RatingStars } from './RatingStars';
import { toast } from 'sonner';
import { Trash2, Lock } from 'lucide-react';

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ratedUserId: string;
  ratedUserName: string;
  onSaved?: () => void;
}

interface RateableRental {
  rental_id: string;
  listing_id: string;
  listing_title: string;
  completed_at: string;
  already_rated: boolean;
}

export const RatingDialog = ({ open, onOpenChange, ratedUserId, ratedUserName, onSaved }: RatingDialogProps) => {
  const { user } = useAuth();
  const [rentals, setRentals] = useState<RateableRental[]>([]);
  const [selectedRentalId, setSelectedRentalId] = useState<string>('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  const [alreadyRatedPair, setAlreadyRatedPair] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    setExistingId(null);
    setRating(0);
    setComment('');
    setSelectedRentalId('');
    setAlreadyRatedPair(false);

    (async () => {
      // Pair-level check: has this user ever rated the target before?
      const { data: existingPair } = await supabase
        .from('user_ratings')
        .select('id')
        .eq('rater_id', user.id)
        .eq('rated_user_id', ratedUserId)
        .maybeSingle();

      if (existingPair) {
        setAlreadyRatedPair(true);
        setRentals([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase.rpc('get_rateable_rentals', {
        p_rater: user.id,
        p_rated: ratedUserId,
      });
      const list = (data ?? []) as RateableRental[];
      setRentals(list);
      // Auto-pick most recent rental (one rating per pair regardless)
      if (list[0]) setSelectedRentalId(list[0].rental_id);
      setLoading(false);
    })();
  }, [open, user, ratedUserId]);

  const handleSubmit = async () => {
    if (!user) { toast.error('سجل دخول لإضافة تقييم'); return; }
    if (!selectedRentalId) { toast.error('اختر إيجاراً مكتملاً'); return; }
    if (rating < 1 || rating > 5) { toast.error('اختر عدد النجوم'); return; }
    if (comment.length > 500) { toast.error('التعليق طويل جداً'); return; }

    setSubmitting(true);
    const payload = {
      rater_id: user.id,
      rated_user_id: ratedUserId,
      rental_id: selectedRentalId,
      rating,
      comment: comment.trim() || null,
    };
    const { error } = existingId
      ? await supabase.from('user_ratings').update(payload).eq('id', existingId)
      : await supabase.from('user_ratings').insert(payload);
    setSubmitting(false);

    if (error) { toast.error(error.message || 'تعذر حفظ التقييم'); return; }
    toast.success(existingId ? 'تم تحديث تقييمك' : 'شكراً على تقييمك');
    onOpenChange(false);
    onSaved?.();
  };

  const handleDelete = async () => {
    if (!existingId) return;
    setSubmitting(true);
    const { error } = await supabase.from('user_ratings').delete().eq('id', existingId);
    setSubmitting(false);
    if (error) { toast.error('تعذر حذف التقييم'); return; }
    toast.success('تم حذف التقييم');
    onOpenChange(false);
    onSaved?.();
  };

  const noRentals = !loading && rentals.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-cairo">تقييم {ratedUserName}</DialogTitle>
          <DialogDescription>التقييم متاح فقط بعد اكتمال إيجار بينكما</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">جاري التحميل...</p>
        ) : noRentals ? (
          <div className="flex flex-col items-center py-6 gap-3 text-center">
            <Lock className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold">لا يمكن التقييم</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              لا يوجد إيجار مكتمل بينكما يسمح بالتقييم. يصبح التقييم متاحاً بعد إتمام عملية إيجار رسمية.
            </p>
          </div>
        ) : (
          <>
            {rentals.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">الإيجار</label>
                <Select value={selectedRentalId} onValueChange={setSelectedRentalId}>
                  <SelectTrigger><SelectValue placeholder="اختر إيجاراً" /></SelectTrigger>
                  <SelectContent>
                    {rentals.map((r) => (
                      <SelectItem key={r.rental_id} value={r.rental_id}>
                        {r.listing_title}{r.already_rated ? ' (تم التقييم)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-center py-2">
              <RatingStars value={rating} onChange={setRating} size="lg" />
            </div>

            <Textarea
              placeholder="اكتب تعليقاً (اختياري)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-left">{comment.length}/500</p>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting || rating < 1 || !selectedRentalId} className="flex-1">
                {existingId ? 'تحديث' : 'إرسال'}
              </Button>
              {existingId && (
                <Button variant="outline" size="icon" onClick={handleDelete} disabled={submitting}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
