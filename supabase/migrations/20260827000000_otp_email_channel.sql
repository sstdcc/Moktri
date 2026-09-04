-- OTP channel switch: SMS/phone -> Email, while keeping phone available.
-- Backward-compatible: keeps `phone` column and all existing data.
-- - Existing rows become channel='phone' + identifier=phone (backfill).
-- - New email-channel rows use identifier=<email>, channel='email', phone=NULL.

-- otp_codes.phone was NOT NULL (create 20260330002032); email-channel rows may
-- have no phone, so the constraint must be relaxed. No column/type change.
ALTER TABLE public.otp_codes ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS channel    text NOT NULL DEFAULT 'phone';
ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS identifier text;

-- Backfill identifier for existing phone-channel rows (non-destructive).
UPDATE public.otp_codes
SET identifier = phone
WHERE identifier IS NULL AND channel = 'phone' AND phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_codes_channel_identifier
  ON public.otp_codes (identifier, channel, verified, expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_codes_channel_created
  ON public.otp_codes (channel, created_at DESC);