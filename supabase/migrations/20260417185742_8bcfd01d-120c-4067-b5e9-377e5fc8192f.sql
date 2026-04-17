-- Allow renters to create rental records from the housing request flow
CREATE POLICY "Renter can create rental"
ON public.rentals
FOR INSERT
WITH CHECK (auth.uid() = renter_id);
