-- Add 'renter' to verification_role enum
ALTER TYPE public.verification_role ADD VALUE IF NOT EXISTS 'renter';

-- Add email column to verification_applications
ALTER TABLE public.verification_applications ADD COLUMN IF NOT EXISTS email text;