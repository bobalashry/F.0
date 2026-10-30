/*
# Fix precedence in admin_grant_access

1. Changed functions
- `admin_grant_access(uuid, text[])`: the protection check now reads as two clear rules.

2. Why
- The previous condition mixed OR and AND without parentheses. It was correct only by accident of operator precedence.

3. New rules (checked in order)
- Only a super admin can grant or change assistant access.
- No one can change their own access.
- The super admin account can never be changed through this function.
- The target must be an existing member and at least one permission must be given.

4. Security
- No table or grant changes. The function keeps SECURITY DEFINER with a fixed search_path.
- Every successful call is written to the admin activity log.
*/

CREATE OR REPLACE FUNCTION public.admin_grant_access(p_user_id uuid, p_permissions text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = auth.uid()
     OR EXISTS (
       SELECT 1 FROM public.admin_members m
       WHERE m.user_id = p_user_id AND m.role = 'super_admin'
     ) THEN
    RAISE EXCEPTION 'protected_account' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id) THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_permissions IS NULL OR cardinality(p_permissions) = 0 THEN
    RAISE EXCEPTION 'permissions_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.admin_members (user_id, role, permissions, is_active, created_by)
  VALUES (p_user_id, 'assistant', p_permissions, true, auth.uid())
  ON CONFLICT (user_id) DO UPDATE
    SET permissions = EXCLUDED.permissions,
        is_active = true
    WHERE public.admin_members.role <> 'super_admin';

  PERFORM public.log_admin_action(
    'grant_admin_access', 'member', p_user_id::text, jsonb_build_object('permissions', p_permissions)
  );
END;
$function$;
