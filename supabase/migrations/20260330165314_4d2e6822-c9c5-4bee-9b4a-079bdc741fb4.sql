
-- Fix: on_verification_application_insert should bypass protect_profile_fields
-- by setting the local role context. Instead, we modify protect_profile_fields
-- to allow changes when called from a trigger (session_user = system context).
-- Simplest fix: have on_verification_application_insert set a flag.

CREATE OR REPLACE FUNCTION public.on_verification_application_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use SECURITY DEFINER + direct update bypasses RLS but not other triggers.
  -- Set a GUC flag so protect_profile_fields allows this change.
  PERFORM set_config('app.bypass_profile_protection', 'true', true);
  UPDATE public.profiles
  SET verification_badge = 'pending'
  WHERE id = NEW.applicant_id
    AND verification_badge IN ('none', 'rejected');
  PERFORM set_config('app.bypass_profile_protection', 'false', true);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_role user_role;
BEGIN
  -- Allow internal trigger-based updates
  IF current_setting('app.bypass_profile_protection', true) = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  
  IF caller_role IN ('admin', 'moderator') THEN
    RETURN NEW;
  END IF;
  
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'ليس لديك صلاحية لتغيير الدور';
  END IF;
  
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    RAISE EXCEPTION 'ليس لديك صلاحية لتغيير حالة التحقق';
  END IF;
  
  IF NEW.verification_badge IS DISTINCT FROM OLD.verification_badge THEN
    RAISE EXCEPTION 'ليس لديك صلاحية لتغيير شارة التحقق';
  END IF;
  
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'ليس لديك صلاحية لتغيير حالة الحساب';
  END IF;
  
  IF NEW.total_listings IS DISTINCT FROM OLD.total_listings THEN
    NEW.total_listings := OLD.total_listings;
  END IF;
  
  IF NEW.total_responses IS DISTINCT FROM OLD.total_responses THEN
    NEW.total_responses := OLD.total_responses;
  END IF;
  
  RETURN NEW;
END;
$$;
