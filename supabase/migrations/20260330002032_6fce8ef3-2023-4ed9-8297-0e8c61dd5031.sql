
CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.otp_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_otp_codes_phone ON public.otp_codes (phone, verified, expires_at);
