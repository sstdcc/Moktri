-- Google OAuth users get a blank profile (no phone, no full_name) so onboarding is enforced.
-- Email/phone sign-up behaviour is unchanged.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.app_metadata->>'provider' = 'google' THEN
    INSERT INTO public.profiles (id, full_name, phone)
    VALUES (NEW.id, '', NULL);
  ELSE
    INSERT INTO public.profiles (id, full_name, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(
        CASE WHEN NEW.phone IS NOT NULL AND NEW.phone !~ '^\+' THEN '+' || NEW.phone ELSE NEW.phone END,
        NEW.raw_user_meta_data->>'phone',
        ''
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
