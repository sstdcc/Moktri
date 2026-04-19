-- Allow owners to notify admins about a pending-review rental
CREATE POLICY "Owners can notify admins of pending review"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  type = 'rental_pending_review'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = notifications.user_id
      AND p.role IN ('admin','moderator')
  )
  AND EXISTS (
    SELECT 1 FROM public.rentals r
    WHERE r.owner_id = auth.uid()
      AND r.status = 'pending_review'
  )
);