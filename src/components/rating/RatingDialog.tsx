import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RatingStars } from './RatingStars';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ratedUserId: string;
  ratedUserName: string;
  onSaved?: () => void;
}

export const RatingDialog = ({ open, onOpenChange, ratedUserId, ratedUserName, onSaved }: RatingDialogProps) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from('user_ratings')
        .select('id, rating, comment')
        .eq('rater_id', user.id)
        .eq('rated_user_id', ratedUserId)
        .maybeSingle();
      if (data) {
        setExistingId(data.id);
        setRating(data.rating);
        setComment(data.comment ?? '');
      } else {
        setExistingId(null);
        setRating(0);
        setComment('');
      }
    })();
  }, [open, user, ratedUserId]);

  const handleSubmit = async () => {
    if (!user) { toast.error('سجل دخول لإضافة تقييم'); return; }
    if (rating < 1 || rating > 5) { toast.error('اختر عدد النجوم'); return; }
    if (comment.length > 500) { toast.error('التعليق طويل جداً'); return; }

    setSubmitting(true);
    const payload = { rater_id: user.id, rated_user_id: ratedUserId, rating, comment: comment.trim() || null };
    const { error } = existingId
      ? await supabase.from('user_ratings').update(payload).eq('id', existingId)
      : await supabase.from('user_ratings').insert(payload);
    setSubmitting(false);

    if (error) { toast.error('تعذر حفظ التقييم'); return; }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-cairo">تقييم {ratedUserName}</DialogTitle>
          <DialogDescription>شارك تجربتك بصدق لمساعدة الآخرين</DialogDescription>
        </DialogHeader>

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
          <Button onClick={handleSubmit} disabled={submitting || rating < 1} className="flex-1">
            {existingId ? 'تحديث' : 'إرسال'}
          </Button>
          {existingId && (
            <Button variant="outline" size="icon" onClick={handleDelete} disabled={submitting}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
