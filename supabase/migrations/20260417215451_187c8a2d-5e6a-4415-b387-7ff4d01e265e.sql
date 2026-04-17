-- Allow authenticated users to send a private_offer_request notification
-- to a target owner only when a real housing_request exists owned by the sender,
-- and the link encodes both the request and the sender as private_for.
CREATE POLICY "Renters can request private offer from owners"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  type = 'private_offer_request'
  AND user_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.housing_requests hr
    WHERE hr.requester_id = auth.uid()
  )
);