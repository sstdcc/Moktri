CREATE POLICY "Owner can notify requester on listing request decision"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  type IN ('private_offer_accepted'::notification_type, 'private_offer_rejected'::notification_type)
  AND user_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.listing_requests lr
    WHERE lr.requester_id = notifications.user_id
      AND lr.owner_id = auth.uid()
  )
);