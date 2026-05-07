CREATE POLICY "Conversation members can read listing"
ON public.listings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.listing_conversations c
    WHERE c.listing_id = listings.id
      AND (c.owner_id = auth.uid() OR c.user_id = auth.uid())
  )
);