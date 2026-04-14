
-- Auto-create notifications for admins when a new report is created
CREATE OR REPLACE FUNCTION public.notify_admins_new_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title_ar, body_ar, link)
  SELECT p.id, 'new_report', 'بلاغ جديد', 'تم تقديم بلاغ جديد يحتاج مراجعتك', '/dashboard/admin/reports'
  FROM public.profiles p
  WHERE p.role IN ('admin', 'moderator');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_report_notify_admins
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_new_report();

-- Auto-create notifications for admins when a new verification application is submitted
CREATE OR REPLACE FUNCTION public.notify_admins_new_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title_ar, body_ar, link)
  SELECT p.id, 'verification_update', 'طلب توثيق جديد', 'تم تقديم طلب توثيق جديد يحتاج مراجعتك', '/dashboard/admin/verifications'
  FROM public.profiles p
  WHERE p.role IN ('admin', 'moderator');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_verification_notify_admins
  AFTER INSERT ON public.verification_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_new_verification();

-- Auto-create notifications for admins when a listing is submitted for review
CREATE OR REPLACE FUNCTION public.notify_admins_listing_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'pending_review' AND (OLD.status IS NULL OR OLD.status != 'pending_review') THEN
    INSERT INTO public.notifications (user_id, type, title_ar, body_ar, link)
    SELECT p.id, 'system', 'إعلان بانتظار المراجعة', 'تم تقديم إعلان جديد يحتاج مراجعتك', '/dashboard/admin/listings'
    FROM public.profiles p
    WHERE p.role IN ('admin', 'moderator');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_listing_pending_review_notify_admins
  AFTER INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_listing_pending();

-- Allow service-level inserts for notification triggers (SECURITY DEFINER handles this)
-- Also allow the system to insert notifications via triggers
CREATE POLICY "System can insert notifications via triggers"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
