ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS ip_address text;
CREATE INDEX IF NOT EXISTS idx_otp_codes_ip_created ON public.otp_codes(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_created ON public.otp_codes(phone, created_at DESC);