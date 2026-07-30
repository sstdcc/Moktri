-- Add DELETE permission for authenticated users on notifications table.
-- Previously only SELECT, INSERT, UPDATE were granted (see migration
-- 20260724150000 line 68). DELETE was omitted.

GRANT DELETE ON public.notifications TO authenticated;

-- FOR DELETE RLS policy: users can only delete their own notifications.
-- Matches the existing FOR SELECT and FOR UPDATE policy pattern from
-- migration 20260329221626 lines 207-208.

CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);
