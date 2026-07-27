-- Check if email already exists in auth.users (used by send-otp for duplicate detection)
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM auth.users WHERE email = p_email);
END;
$$;

-- Look up auth.users.email by profiles.phone (used by secure-login for phone login)
CREATE OR REPLACE FUNCTION public.get_user_email_by_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email auth.users.email%TYPE;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE phone = p_phone;
  RETURN v_email;
END;
$$;

-- Yemeni phone validation constraint
-- Phone is stored as +9677xxxxxxxx (with country code).
-- We strip the +967 prefix and validate the local portion: ^7[0-9]{8}$
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_check
  CHECK (substring(phone from 5) ~ '^7[0-9]{8}$') NOT VALID;
