/*
# Admin visibility: buyers, deals, commissions, ratings

1. Read functions for the admin panel (all SECURITY DEFINER, admin-gated)
- `admin_list_buyers(status, limit)`: every registered buyer with listing, marketer and owner names. Requires the `listings` permission.
- `admin_finance_summary()`: totals of commissions, platform fees and marketer net, plus deal counts. Owner-only (super admin).
- `admin_list_deals(limit)`: deals with their commission split. Owner-only.
- `admin_list_ratings(limit)`: all ratings with the deal number and both names. Requires the `members` permission.

2. Moderation function
- `admin_set_rating_visibility(rating, hidden, reason)`: hides or restores a rating. Hiding requires a reason of at least 5 characters. Every change is written to the admin activity log. Requires the `members` permission.

3. Security
- All functions revoke EXECUTE from PUBLIC and anon, and grant it to authenticated only; the checks inside them enforce who can call them.
- No table privileges change.
*/

CREATE OR REPLACE FUNCTION public.admin_list_buyers(p_status text DEFAULT NULL, p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  reference_number text,
  buyer_name text,
  buyer_phone text,
  status text,
  objection_evidence text,
  protection_ends_at timestamptz,
  created_at timestamptz,
  listing_id uuid,
  listing_title text,
  worker_name text,
  owner_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.assert_admin_permission('listings');

  IF p_status IS NOT NULL AND p_status NOT IN ('pending', 'accepted', 'objected') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.reference_number,
    b.buyer_name,
    b.buyer_phone,
    b.status,
    b.objection_evidence,
    b.protection_ends_at,
    b.created_at,
    b.listing_id,
    l.title,
    w.full_name,
    o.full_name
  FROM public.buyers b
  JOIN public.listings l ON l.id = b.listing_id
  JOIN public.profiles w ON w.id = b.worker_id
  JOIN public.profiles o ON o.id = b.owner_id
  WHERE p_status IS NULL OR b.status = p_status
  ORDER BY b.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_finance_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'commission_total', (SELECT COALESCE(SUM(commission_total), 0) FROM public.deal_financials),
    'platform_fee_total', (SELECT COALESCE(SUM(platform_fee_amount), 0) FROM public.deal_financials),
    'worker_net_total', (SELECT COALESCE(SUM(worker_commission_amount), 0) FROM public.deal_financials),
    'completed_deals', (SELECT count(*) FROM public.deals WHERE status = 'completed'),
    'active_deals', (SELECT count(*) FROM public.deals WHERE status = 'active'),
    'buyers_pending', (SELECT count(*) FROM public.buyers WHERE status = 'pending'),
    'buyers_objected', (SELECT count(*) FROM public.buyers WHERE status = 'objected'),
    'ratings_total', (SELECT count(*) FROM public.deal_ratings),
    'ratings_hidden', (SELECT count(*) FROM public.deal_ratings WHERE is_hidden)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_deals(p_limit integer DEFAULT 100)
RETURNS TABLE (
  deal_id uuid,
  deal_number text,
  listing_title text,
  owner_name text,
  worker_name text,
  status text,
  commission_total numeric,
  platform_fee_amount numeric,
  worker_commission_amount numeric,
  created_at timestamptz,
  completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.deal_number,
    d.listing_title,
    o.full_name,
    w.full_name,
    d.status,
    f.commission_total,
    f.platform_fee_amount,
    f.worker_commission_amount,
    d.created_at,
    d.completed_at
  FROM public.deals d
  JOIN public.profiles o ON o.id = d.owner_id
  JOIN public.profiles w ON w.id = d.worker_id
  LEFT JOIN public.deal_financials f ON f.deal_id = d.id
  ORDER BY d.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_ratings(p_limit integer DEFAULT 100)
RETURNS TABLE (
  rating_id uuid,
  deal_number text,
  rater_name text,
  ratee_name text,
  stars smallint,
  comment text,
  is_hidden boolean,
  hidden_reason text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.assert_admin_permission('members');

  RETURN QUERY
  SELECT
    r.id,
    d.deal_number,
    rater.full_name,
    ratee.full_name,
    r.stars,
    r.comment,
    r.is_hidden,
    r.hidden_reason,
    r.created_at
  FROM public.deal_ratings r
  JOIN public.deals d ON d.id = r.deal_id
  JOIN public.profiles rater ON rater.id = r.rater_id
  JOIN public.profiles ratee ON ratee.id = r.ratee_id
  ORDER BY r.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_rating_visibility(p_rating_id uuid, p_hidden boolean, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  PERFORM public.assert_admin_permission('members');

  IF p_hidden AND char_length(v_reason) < 5 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.deal_ratings
  SET is_hidden = p_hidden,
      hidden_reason = CASE WHEN p_hidden THEN v_reason ELSE NULL END
  WHERE id = p_rating_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rating_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.log_admin_action(
    CASE WHEN p_hidden THEN 'hide_rating' ELSE 'restore_rating' END,
    'rating',
    p_rating_id::text,
    jsonb_build_object('reason', v_reason)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_list_buyers(text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_finance_summary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_deals(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_ratings(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_rating_visibility(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_buyers(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finance_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_deals(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_ratings(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_rating_visibility(uuid, boolean, text) TO authenticated;
