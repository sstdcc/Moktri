
-- Trigger: auto-set verification_badge to 'pending' when a new verification application is inserted
CREATE OR REPLACE FUNCTION public.on_verification_application_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET verification_badge = 'pending'
  WHERE id = NEW.applicant_id
    AND verification_badge IN ('none', 'rejected');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verification_application_insert
  AFTER INSERT ON public.verification_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.on_verification_application_insert();
