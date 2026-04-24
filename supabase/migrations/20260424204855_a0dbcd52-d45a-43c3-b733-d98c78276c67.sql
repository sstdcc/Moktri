
-- 1) Revoke column-level SELECT on private contact fields from anon and authenticated.
-- Other profile fields remain readable per existing policies.
REVOKE SELECT (phone, whatsapp_number) ON public.profiles FROM anon;
REVOKE SELECT (phone, whatsapp_number) ON public.profiles FROM authenticated;
REVOKE SELECT (phone, whatsapp_number) ON public.profiles FROM PUBLIC;

-- Service role keeps full access (it bypasses RLS and grants).
GRANT SELECT (phone, whatsapp_number) ON public.profiles TO service_role;

-- 2) Helper: signed-in user fetches their OWN phone + whatsapp.
CREATE OR REPLACE FUNCTION public.get_my_contact()
RETURNS TABLE(phone text, whatsapp_number text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.phone, p.whatsapp_number
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_contact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_contact() TO authenticated;

-- 3) Helper: admins/moderators can fetch a single user's contact info.
CREATE OR REPLACE FUNCTION public.admin_get_user_contact(_user_id uuid)
RETURNS TABLE(phone text, whatsapp_number text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','moderator')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
    SELECT p.phone, p.whatsapp_number
    FROM public.profiles p
    WHERE p.id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_user_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_contact(uuid) TO authenticated;

-- 4) Helper: resolve a user_id from a phone WITHOUT returning the phone itself.
-- Used by rental fulfillment flows where a party types a counter-party's phone.
CREATE OR REPLACE FUNCTION public.find_user_id_by_phone(_phone text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE phone = _phone LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_user_id_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_phone(text) TO authenticated;

-- 5) Restrict private contact columns on housing request responses.
-- Only the responder and the request owner should ever read those.
REVOKE SELECT (contact_phone, contact_whatsapp) ON public.request_responses FROM anon;
REVOKE SELECT (contact_phone, contact_whatsapp) ON public.request_responses FROM authenticated;
REVOKE SELECT (contact_phone, contact_whatsapp) ON public.request_responses FROM PUBLIC;
GRANT SELECT (contact_phone, contact_whatsapp) ON public.request_responses TO service_role;
