
-- Add otp_hash column for storing hashed OTP codes
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS otp_hash text;

-- Add attempts counter for rate-limiting verification tries per code
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
