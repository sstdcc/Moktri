
CREATE OR REPLACE FUNCTION public.admin_ban_user(_user_id uuid, _ban boolean)
RETURNS void
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
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'لا يمكنك حظر نفسك';
  END IF;

  UPDATE public.profiles
    SET is_active = NOT _ban
    WHERE id = _user_id;

  IF _ban THEN
    UPDATE public.listings
      SET status = 'paused', last_updated_at = now()
      WHERE owner_id = _user_id
        AND status IN ('active','pending_review','negotiating','private_offer','reserved');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, boolean) TO authenticated;
