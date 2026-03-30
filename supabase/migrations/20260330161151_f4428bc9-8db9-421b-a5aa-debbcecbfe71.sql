
-- TASK 1: otp_codes table already has service_role-only policy, which is correct.
-- No public SELECT policy exists. Good.

-- TASK 2 & 3: Create a trigger to prevent users from updating sensitive profile columns
-- This runs BEFORE update and blocks non-admin users from changing protected fields.

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role user_role;
BEGIN
  -- Get the role of the current user
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  
  -- If user is admin or moderator, allow all changes
  IF caller_role IN ('admin', 'moderator') THEN
    RETURN NEW;
  END IF;
  
  -- For regular users, block changes to sensitive columns
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

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();
