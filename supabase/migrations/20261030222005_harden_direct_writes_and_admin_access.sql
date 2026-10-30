/*
# Harden direct writes and add admin access, audit log, account status, and account-type requests

## Plain-English summary
Signed-in users could previously write every column of their own profile, including their account type.
This migration closes that gap, adds a protected admin system with per-admin permissions, an admin activity log,
account suspension and ban fields, and a request flow for changing account type that an admin must approve.

## 1. Locked-down direct writes
- profiles: client may read only public columns (including account status, so the app can show a suspension notice) and update only full_name and governorate. account_type and status are server-only.
- applications: client may insert only listing_id and message. Updates and deletes are removed; they already happen through server functions.
- deals and deal_events: client may read only. All writes happen inside server functions.
- anon role loses all direct table privileges on app tables (RLS already blocked it; this removes the grant too).

## 2. New columns
- profiles.status (active | suspended | banned), status_reason, status_changed_at.
- listings.status gains the value "suspended" (used by admins to stop a violating listing).
- applications.status and worker_id defaults are set explicitly so client inserts that omit them still succeed.

## 3. New tables
- admin_members: one row per administrator. role is super_admin (exactly one allowed) or assistant. permissions is a subset of members, listings. is_active switches admin access off without losing history.
- admin_audit_log: every admin action with actor name, action, target, details, and time. Readable by active admins; written only by server functions.
- account_type_requests: account-type change requests with reason, review status, admin note, reviewer, and time. Users can read their own requests; admins with members permission can read all. Kept as history.

## 4. Server functions
- Helpers: has_admin_permission, is_super_admin, is_active_admin, is_admin_account, is_profile_active, is_account_active, assert_admin_permission, log_admin_action.
- Member management (members permission): admin_set_account_status, admin_delete_member (requires typed email confirmation; blocked if the member has deals), admin_list_members.
- Listing moderation (listings permission): admin_set_listing_status, admin_delete_listing (blocked if deals exist).
- Account-type requests: request_account_type_change (user), review_account_type_request (members permission).
- Admin staff (super admin only): admin_grant_access, admin_revoke_access, admin_list_staff.
- Statistics (any active admin): admin_stats.

## 5. Protections
- The super admin cannot be suspended, banned, deleted, or have access changed by anyone, and cannot act on their own account through admin functions.
- Assistant admins cannot act on any admin account through member functions.
- Every admin function checks the caller on the server; the screen only hides buttons.

## Important notes
1. Account type can now change only through an approved request.
2. The super admin row is created separately once the owner has signed up (see the project notes).
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'suspended', 'banned'));
  END IF;
END $$;

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('active', 'paused', 'closed', 'suspended'));

ALTER TABLE public.applications ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.applications ALTER COLUMN worker_id SET DEFAULT auth.uid();

REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, account_type, full_name, governorate, status) ON public.profiles TO authenticated;
GRANT UPDATE (full_name, governorate) ON public.profiles TO authenticated;

REVOKE ALL ON public.listings, public.applications, public.deals, public.deal_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.applications FROM authenticated;
GRANT INSERT (listing_id, message) ON public.applications TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.deals, public.deal_events FROM authenticated;

CREATE TABLE IF NOT EXISTS public.admin_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'assistant')),
  permissions text[] NOT NULL DEFAULT '{}' CHECK (permissions <@ ARRAY['members', 'listings']::text[]),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_members_one_super_admin
  ON public.admin_members (role) WHERE role = 'super_admin';

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);

CREATE TABLE IF NOT EXISTS public.account_type_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  current_type text NOT NULL CHECK (current_type IN ('worker', 'owner')),
  requested_type text NOT NULL CHECK (requested_type IN ('worker', 'owner')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (current_type <> requested_type)
);

CREATE UNIQUE INDEX IF NOT EXISTS account_type_requests_one_pending
  ON public.account_type_requests (user_id) WHERE status = 'pending';

ALTER TABLE public.admin_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_type_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_members, public.admin_audit_log, public.account_type_requests FROM anon, authenticated;
GRANT SELECT ON public.admin_members, public.admin_audit_log, public.account_type_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.has_admin_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_members m
    WHERE m.user_id = auth.uid()
      AND m.is_active
      AND (m.role = 'super_admin' OR p_permission = ANY (m.permissions))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_members m
    WHERE m.user_id = auth.uid() AND m.is_active AND m.role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_members m
    WHERE m.user_id = auth.uid() AND m.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_account(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_members m WHERE m.user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_profile_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id AND p.status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.is_account_active()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_profile_active(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.assert_admin_permission(p_permission text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_admin_permission(p_permission) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id = auth.uid();
  INSERT INTO public.admin_audit_log (actor_id, actor_name, action, target_type, target_id, details)
  VALUES (auth.uid(), COALESCE(v_name, 'مشرف'), p_action, p_target_type, p_target_id, COALESCE(p_details, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE VIEW public.dummy_placeholder_do_not_use AS SELECT 1 AS n;
DROP VIEW IF EXISTS public.dummy_placeholder_do_not_use;

CREATE OR REPLACE FUNCTION public.admin_set_account_status(p_user_id uuid, p_status text, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin_permission('members');

  IF p_status NOT IN ('active', 'suspended', 'banned') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  IF p_user_id = auth.uid() OR public.is_admin_account(p_user_id) THEN
    RAISE EXCEPTION 'protected_account' USING ERRCODE = '42501';
  END IF;

  IF p_status <> 'active' AND char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET status = p_status,
      status_reason = CASE WHEN p_status = 'active' THEN NULL ELSE btrim(p_reason) END,
      status_changed_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.log_admin_action(
    'change_account_status', 'member', p_user_id::text,
    jsonb_build_object('status', p_status, 'reason', btrim(COALESCE(p_reason, '')))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_member(p_user_id uuid, p_confirm_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  PERFORM public.assert_admin_permission('members');

  IF p_user_id = auth.uid() OR public.is_admin_account(p_user_id) THEN
    RAISE EXCEPTION 'protected_account' USING ERRCODE = '42501';
  END IF;

  SELECT u.email::text INTO v_email FROM auth.users u WHERE u.id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF lower(btrim(COALESCE(p_confirm_email, ''))) <> lower(v_email) THEN
    RAISE EXCEPTION 'confirmation_mismatch' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.deals d WHERE d.owner_id = p_user_id OR d.worker_id = p_user_id) THEN
    RAISE EXCEPTION 'member_has_deals' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.log_admin_action('delete_account', 'member', p_user_id::text, jsonb_build_object('email', v_email));

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_members(p_search text, p_limit integer DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  account_type text,
  status text,
  status_reason text,
  governorate text,
  created_at timestamptz,
  admin_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin_permission('members');

  RETURN QUERY
  SELECT p.id, p.full_name, u.email::text, p.account_type, p.status, p.status_reason, p.governorate, u.created_at, m.role
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.admin_members m ON m.user_id = p.id AND m.is_active
  WHERE btrim(COALESCE(p_search, '')) = ''
     OR p.full_name ILIKE '%' || btrim(p_search) || '%'
     OR u.email ILIKE '%' || btrim(p_search) || '%'
  ORDER BY u.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_listing_status(p_listing_id uuid, p_status text, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin_permission('listings');

  IF p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  IF p_status = 'suspended' AND char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.listings SET status = p_status WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.log_admin_action(
    'change_listing_status', 'listing', p_listing_id::text,
    jsonb_build_object('status', p_status, 'reason', btrim(COALESCE(p_reason, '')))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_listing(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin_permission('listings');

  IF EXISTS (SELECT 1 FROM public.deals d WHERE d.listing_id = p_listing_id) THEN
    RAISE EXCEPTION 'listing_has_deals' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.log_admin_action('delete_listing', 'listing', p_listing_id::text, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_account_type_change(p_requested_type text, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_account_active() THEN
    RAISE EXCEPTION 'account_not_active' USING ERRCODE = '42501';
  END IF;

  SELECT p.account_type INTO v_current FROM public.profiles p WHERE p.id = auth.uid();

  IF p_requested_type NOT IN ('worker', 'owner') OR p_requested_type = v_current THEN
    RAISE EXCEPTION 'invalid_account_type' USING ERRCODE = '22023';
  END IF;

  IF char_length(btrim(COALESCE(p_reason, ''))) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'reason_invalid' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.account_type_requests r WHERE r.user_id = auth.uid() AND r.status = 'pending') THEN
    RAISE EXCEPTION 'request_already_pending' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.account_type_requests (user_id, current_type, requested_type, reason)
  VALUES (auth.uid(), v_current, p_requested_type, btrim(p_reason))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_account_type_request(p_request_id uuid, p_approve boolean, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.account_type_requests%ROWTYPE;
  v_current text;
BEGIN
  PERFORM public.assert_admin_permission('members');

  SELECT r.* INTO v_request FROM public.account_type_requests r WHERE r.id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.account_type INTO v_current FROM public.profiles p WHERE p.id = v_request.user_id;
  IF v_current IS DISTINCT FROM v_request.current_type THEN
    RAISE EXCEPTION 'request_stale' USING ERRCODE = 'P0001';
  END IF;

  IF p_approve THEN
    UPDATE public.profiles SET account_type = v_request.requested_type WHERE id = v_request.user_id;
  END IF;

  UPDATE public.account_type_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      admin_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_request_id;

  PERFORM public.log_admin_action(
    'review_account_type_request', 'account_type_request', p_request_id::text,
    jsonb_build_object('approved', p_approve, 'from', v_request.current_type, 'to', v_request.requested_type)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_access(p_user_id uuid, p_permissions text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = auth.uid() OR public.is_admin_account(p_user_id) AND EXISTS (
    SELECT 1 FROM public.admin_members m WHERE m.user_id = p_user_id AND m.role = 'super_admin'
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
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_access(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'protected_account' USING ERRCODE = '42501';
  END IF;

  UPDATE public.admin_members
  SET is_active = false, permissions = '{}'
  WHERE user_id = p_user_id AND role = 'assistant';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.log_admin_action('revoke_admin_access', 'member', p_user_id::text, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_staff()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  admin_role text,
  permissions text[],
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT m.user_id, p.full_name, u.email::text, m.role, m.permissions, m.is_active, m.created_at
  FROM public.admin_members m
  JOIN public.profiles p ON p.id = m.user_id
  JOIN auth.users u ON u.id = m.user_id
  ORDER BY m.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'members', (SELECT count(*) FROM public.profiles),
    'owners', (SELECT count(*) FROM public.profiles WHERE account_type = 'owner'),
    'workers', (SELECT count(*) FROM public.profiles WHERE account_type = 'worker'),
    'restricted_accounts', (SELECT count(*) FROM public.profiles WHERE status <> 'active'),
    'listings', (SELECT count(*) FROM public.listings),
    'active_listings', (SELECT count(*) FROM public.listings WHERE status = 'active'),
    'deals', (SELECT count(*) FROM public.deals),
    'commissions_total', (
      SELECT COALESCE(SUM(CASE WHEN d.commission_type = 'fixed' THEN d.commission_value
                               ELSE d.listing_price * d.commission_value / 100 END), 0)
      FROM public.deals d
    ),
    'pending_type_requests', (SELECT count(*) FROM public.account_type_requests WHERE status = 'pending')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

ALTER TABLE public.admin_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_admin_row" ON public.admin_members;
CREATE POLICY "select_own_admin_row" ON public.admin_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "select_admin_audit_log" ON public.admin_audit_log;
CREATE POLICY "select_admin_audit_log" ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

DROP POLICY IF EXISTS "select_own_or_reviewable_type_requests" ON public.account_type_requests;
CREATE POLICY "select_own_or_reviewable_type_requests" ON public.account_type_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_admin_permission('members'));

DROP POLICY IF EXISTS "select_visible_listings" ON public.listings;
CREATE POLICY "select_visible_listings" ON public.listings FOR SELECT
  TO authenticated
  USING (
    (status = 'active' AND public.is_profile_active(owner_id))
    OR owner_id = auth.uid()
    OR public.has_admin_permission('listings')
  );

DROP POLICY IF EXISTS "select_related_applications" ON public.applications;
CREATE POLICY "select_related_applications" ON public.applications FOR SELECT
  TO authenticated
  USING (
    worker_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.listings l WHERE l.id = applications.listing_id AND l.owner_id = auth.uid())
    OR public.has_admin_permission('listings')
  );

REVOKE EXECUTE ON FUNCTION
  public.has_admin_permission(text), public.is_super_admin(), public.is_active_admin(),
  public.is_admin_account(uuid), public.is_profile_active(uuid), public.is_account_active(),
  public.assert_admin_permission(text), public.log_admin_action(text, text, text, jsonb),
  public.admin_set_account_status(uuid, text, text), public.admin_delete_member(uuid, text),
  public.admin_list_members(text, integer), public.admin_set_listing_status(uuid, text, text),
  public.admin_delete_listing(uuid), public.request_account_type_change(text, text),
  public.review_account_type_request(uuid, boolean, text), public.admin_grant_access(uuid, text[]),
  public.admin_revoke_access(uuid), public.admin_list_staff(), public.admin_stats()
FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION
  public.assert_admin_permission(text), public.log_admin_action(text, text, text, jsonb),
  public.is_admin_account(uuid)
FROM authenticated;

GRANT EXECUTE ON FUNCTION
  public.has_admin_permission(text), public.is_super_admin(), public.is_active_admin(),
  public.is_profile_active(uuid), public.is_account_active(),
  public.admin_set_account_status(uuid, text, text), public.admin_delete_member(uuid, text),
  public.admin_list_members(text, integer), public.admin_set_listing_status(uuid, text, text),
  public.admin_delete_listing(uuid), public.request_account_type_change(text, text),
  public.review_account_type_request(uuid, boolean, text), public.admin_grant_access(uuid, text[]),
  public.admin_revoke_access(uuid), public.admin_list_staff(), public.admin_stats()
TO authenticated;
