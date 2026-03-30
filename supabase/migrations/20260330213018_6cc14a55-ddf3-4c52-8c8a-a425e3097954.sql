
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller_role user_role;
BEGIN
  IF current_setting('app.bypass_profile_protection', true) = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  
  IF caller_role IN ('admin', 'moderator') THEN
    RETURN NEW;
  END IF;
  
  -- Allow role change during initial onboarding (when full_name is still empty)
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF OLD.full_name IS NOT NULL AND OLD.full_name != '' THEN
      RAISE EXCEPTION 'ليس لديك صلاحية لتغيير الدور';
    END IF;
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
$function$;
