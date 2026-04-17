CREATE POLICY "Reserved renter can notify owner about private offer"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  type IN ('private_offer_accepted'::notification_type, 'private_offer_rejected'::notification_type)
  AND user_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.owner_id = notifications.user_id
      AND l.reserved_for_user_id = auth.uid()
  )
);