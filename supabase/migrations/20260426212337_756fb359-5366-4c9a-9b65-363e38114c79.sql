-- 1. Audit log table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON public.admin_audit_logs(target_type, target_id);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can read audit logs"
ON public.admin_audit_logs FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','moderator')));

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can insert audit logs"
ON public.admin_audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  admin_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','moderator'))
);

-- 2. Helper to insert audit rows from triggers (bypasses RLS but checks admin role)
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text,
  _target_type text,
  _target_id uuid,
  _details jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('admin','moderator') THEN
    RETURN;
  END IF;
  INSERT INTO public.admin_audit_logs(admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), _action, _target_type, _target_id, _details);
END;
$$;

-- 3. Trigger: profile changes (ban/unban, verify/unverify)
CREATE OR REPLACE FUNCTION public.audit_profile_admin_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role user_role;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = NEW.id THEN
    RETURN NEW;
  END IF;
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('admin','moderator') THEN
    RETURN NEW;
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    PERFORM public.log_admin_action(
      CASE WHEN NEW.is_active THEN 'unban_user' ELSE 'ban_user' END,
      'profile', NEW.id,
      jsonb_build_object('from', OLD.is_active, 'to', NEW.is_active)
    );
  END IF;

  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    PERFORM public.log_admin_action(
      CASE WHEN NEW.is_verified THEN 'verify_user' ELSE 'unverify_user' END,
      'profile', NEW.id,
      jsonb_build_object('from', OLD.is_verified, 'to', NEW.is_verified)
    );
  END IF;

  IF NEW.verification_badge IS DISTINCT FROM OLD.verification_badge THEN
    PERFORM public.log_admin_action(
      'change_verification_badge',
      'profile', NEW.id,
      jsonb_build_object('from', OLD.verification_badge, 'to', NEW.verification_badge)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profile_admin_changes ON public.profiles;
CREATE TRIGGER trg_audit_profile_admin_changes
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_profile_admin_changes();

-- 4. Trigger: listing moderation
CREATE OR REPLACE FUNCTION public.audit_listing_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role user_role;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = NEW.owner_id THEN
    RETURN NEW;
  END IF;
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('admin','moderator') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text = 'active' AND OLD.status::text IN ('pending_review','rejected') THEN
      PERFORM public.log_admin_action('approve_listing', 'listing', NEW.id,
        jsonb_build_object('from', OLD.status, 'to', NEW.status, 'title', NEW.title));
    ELSIF NEW.status::text = 'rejected' THEN
      PERFORM public.log_admin_action('reject_listing', 'listing', NEW.id,
        jsonb_build_object('from', OLD.status, 'to', NEW.status, 'title', NEW.title, 'note', NEW.moderation_note));
    ELSE
      PERFORM public.log_admin_action('change_listing_status', 'listing', NEW.id,
        jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_listing_moderation ON public.listings;
CREATE TRIGGER trg_audit_listing_moderation
AFTER UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.audit_listing_moderation();

-- 5. Trigger: rental admin review
CREATE OR REPLACE FUNCTION public.audit_rental_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role user_role;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = NEW.owner_id OR auth.uid() = NEW.renter_id OR auth.uid() = NEW.broker_id THEN
    RETURN NEW;
  END IF;
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('admin','moderator') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_admin_action(
      CASE
        WHEN NEW.status::text = 'completed' THEN 'approve_rental'
        WHEN NEW.status::text = 'rejected' THEN 'reject_rental'
        ELSE 'change_rental_status'
      END,
      'rental', NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'listing_id', NEW.listing_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_rental_review ON public.rentals;
CREATE TRIGGER trg_audit_rental_review
AFTER UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.audit_rental_review();

-- 6. Trigger: verification application review
CREATE OR REPLACE FUNCTION public.audit_verification_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('admin','moderator') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_admin_action(
      CASE
        WHEN NEW.status::text = 'approved' THEN 'approve_verification'
        WHEN NEW.status::text = 'rejected' THEN 'reject_verification'
        ELSE 'change_verification_status'
      END,
      'verification_application', NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'applicant_id', NEW.applicant_id, 'note', NEW.review_note)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_verification_review ON public.verification_applications;
CREATE TRIGGER trg_audit_verification_review
AFTER UPDATE ON public.verification_applications
FOR EACH ROW EXECUTE FUNCTION public.audit_verification_review();