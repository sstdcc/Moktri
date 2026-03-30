
-- Create storage bucket for verification documents
INSERT INTO storage.buckets (id, name, public) VALUES ('verifications', 'verifications', false) ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- RLS for verifications bucket: users can upload own files, admins can read all
CREATE POLICY "Users upload own verification docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'verifications' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users read own verification docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'verifications' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins read all verification docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'verifications' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')));

-- RLS for avatars bucket: users can manage own, public read
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
