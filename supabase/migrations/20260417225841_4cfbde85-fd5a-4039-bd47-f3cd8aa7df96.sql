CREATE POLICY "Owner/broker can notify rental parties"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  type = 'system'
  AND user_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.rentals r
    WHERE r.owner_id = auth.uid()
      AND (r.renter_id = notifications.user_id OR r.broker_id = notifications.user_id)
  )
);