
-- Create storage bucket for listing images
INSERT INTO storage.buckets (id, name, public) VALUES ('listing-images', 'listing-images', true) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to listing-images bucket
CREATE POLICY "Auth users can upload listing images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'listing-images');

-- Allow anyone to view listing images
CREATE POLICY "Anyone can view listing images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'listing-images');

-- Allow users to delete their own listing images
CREATE POLICY "Users can delete own listing images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = 'listings' AND (storage.foldername(name))[2] = auth.uid()::text);
