/*
# Company and marketer contact details with privacy

1. New profile columns
- phone, company_name, responsible_person, address, city. All nullable.
- phone must be an Egyptian mobile number (11 digits starting with 01).

2. Privacy
- These columns are NOT granted for SELECT to the browser roles, so they cannot be read directly.
- Owners read their own details through get_my_contact_details().
- A worker reads a listing owner's contact details only through get_owner_contact(), which requires
  the worker's application to be accepted (or the caller to be the owner).

3. Writes
- Users update only these columns through column-level UPDATE grants; the existing own-row policy still applies.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS responsible_person text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_format,
  DROP CONSTRAINT IF EXISTS profiles_contact_length;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_format CHECK (phone IS NULL OR phone ~ '^01[0125][0-9]{8}$'),
  ADD CONSTRAINT profiles_contact_length CHECK (
    char_length(coalesce(company_name, '')) <= 120
    AND char_length(coalesce(responsible_person, '')) <= 120
    AND char_length(coalesce(address, '')) <= 300
    AND char_length(coalesce(city, '')) <= 80
  );

GRANT UPDATE (phone, company_name, responsible_person, address, city) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_contact_details()
RETURNS TABLE (company_name text, responsible_person text, phone text, address text, city text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.company_name, p.responsible_person, p.phone, p.address, p.city
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_owner_contact(p_listing_id uuid)
RETURNS TABLE (company_name text, responsible_person text, phone text, address text, governorate text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_account_active() THEN
    RAISE EXCEPTION 'account_not_active' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.listings l
    WHERE l.id = p_listing_id
      AND (
        l.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.applications a
          WHERE a.listing_id = l.id
            AND a.worker_id = auth.uid()
            AND a.status = 'accepted'
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.company_name, p.responsible_person, p.phone, p.address, p.governorate
  FROM public.listings l
  JOIN public.profiles p ON p.id = l.owner_id
  WHERE l.id = p_listing_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_my_contact_details() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_contact_details() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_contact(uuid) TO authenticated;
