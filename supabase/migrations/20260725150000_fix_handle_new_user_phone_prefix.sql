-- Fix handle_new_user to prepend '+' to phone if GoTrue v2.193.1 stripped it
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      CASE WHEN NEW.phone IS NOT NULL AND NEW.phone !~ '^\+' THEN '+' || NEW.phone ELSE NEW.phone END,
      NEW.raw_user_meta_data->>'phone',
      ''
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
