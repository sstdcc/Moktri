
-- Fix old phone numbers that are missing the + prefix
-- Old format: 9677XXXXXXXX (12 chars, no +)
-- New format: +9677XXXXXXXX (13 chars, with +)
-- This is required by the profiles_phone_check CHECK constraint

UPDATE public.profiles
SET phone = '+' || phone
WHERE phone NOT LIKE '+%';

UPDATE auth.users
SET phone = '+' || phone
WHERE phone NOT LIKE '+%';
