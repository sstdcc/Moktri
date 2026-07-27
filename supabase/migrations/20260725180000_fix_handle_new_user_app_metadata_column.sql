-- Fix column name: auth.users has raw_app_meta_data, not app_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.raw_app_meta_data->>'provider' = 'google' THEN
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
