-- Google OAuth users start without a phone; allow NULL until onboarding completes
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
