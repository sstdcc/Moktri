
CREATE OR REPLACE FUNCTION public.admin_update_user(
  _user_id uuid,
  _full_name text,
  _phone text,
  _email text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مسجل';
  END IF;
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('admin','moderator') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.profiles
    SET full_name = COALESCE(NULLIF(_full_name, ''), full_name),
        phone = COALESCE(NULLIF(_phone, ''), phone),
        updated_at = now()
    WHERE id = _user_id;

  IF _phone IS NOT NULL AND _phone <> '' THEN
    UPDATE auth.users SET phone = _phone WHERE id = _user_id;
  END IF;

  IF _email IS NOT NULL AND _email <> '' THEN
    UPDATE auth.users SET email = _email, email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = _user_id;
  END IF;

  PERFORM public.log_admin_action('edit_user_profile', 'profile', _user_id,
    jsonb_build_object('full_name', _full_name, 'phone', _phone, 'email', _email));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text, text, text) TO authenticated;
