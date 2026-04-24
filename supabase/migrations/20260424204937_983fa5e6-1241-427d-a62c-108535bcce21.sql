
CREATE OR REPLACE FUNCTION public.admin_list_users(
  _search text DEFAULT NULL,
  _role text DEFAULT NULL,
  _status text DEFAULT NULL,
  _verified text DEFAULT NULL,
  _limit int DEFAULT 200
)
RETURNS TABLE(
  id uuid,
  full_name text,
  phone text,
  whatsapp_number text,
  avatar_url text,
  role user_role,
  is_verified boolean,
  verification_badge verification_badge_status,
  is_active boolean,
  total_listings int,
  total_responses int,
  created_at timestamptz
)
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
  SELECT p.id, p.full_name, p.phone, p.whatsapp_number, p.avatar_url, p.role,
         p.is_verified, p.verification_badge, p.is_active,
         p.total_listings, p.total_responses, p.created_at
  FROM public.profiles p
  WHERE
    (_search IS NULL OR _search = '' OR p.full_name ILIKE '%'||_search||'%' OR p.phone ILIKE '%'||_search||'%')
    AND (_role IS NULL OR _role = 'all' OR p.role::text = _role)
    AND (_status IS NULL OR _status = 'all'
         OR (_status = 'active' AND p.is_active = true)
         OR (_status = 'suspended' AND p.is_active = false))
    AND (_verified IS NULL OR _verified = 'all'
         OR (_verified = 'verified' AND p.is_verified = true)
         OR (_verified = 'unverified' AND p.is_verified = false))
  ORDER BY p.created_at DESC
  LIMIT _limit;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_users(text,text,text,text,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text,text,text,text,int) TO authenticated;
