/*
# Add server-side deal actions

Plain-English summary:
Four protected actions handle every decision in a deal. The database checks who is calling and what state the item is in before changing anything:
- accept_application: the listing owner accepts a pending applicant. This creates a deal with a unique deal number and a snapshot of the agreed terms, and records it in the deal history.
- reject_application: the listing owner rejects a pending applicant.
- withdraw_application: the applicant withdraws their own pending application.
- complete_deal: the listing owner marks an active deal as completed and it is recorded in the deal history.

## 1. Functions added
- accept_application(application_id) returns the new deal id
- reject_application(application_id)
- withdraw_application(application_id)
- complete_deal(deal_id)

## 2. Security
- Each function runs with checks for the caller's identity, role and current status.
- Only signed-in users can run them. Anonymous users and the public role cannot.
- Clients cannot write deals or deal history directly, so the record of agreements can only be created by these actions.

## 3. Important notes
1. No payment is processed or held by these functions. They record agreed commission figures only.
2. Errors are returned as short codes that the app translates into clear messages.
*/

CREATE OR REPLACE FUNCTION public.accept_application(p_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.applications%ROWTYPE;
  v_listing public.listings%ROWTYPE;
  v_deal_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_app FROM public.applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = v_app.listing_id FOR UPDATE;
  IF v_listing.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'application_not_pending' USING ERRCODE = 'P0001';
  END IF;

  IF v_listing.status <> 'active' THEN
    RAISE EXCEPTION 'listing_not_active' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.applications SET status = 'accepted' WHERE id = v_app.id;

  INSERT INTO public.deals (
    listing_id, application_id, owner_id, worker_id,
    listing_title, listing_price, commission_type, commission_value, commission_terms
  )
  VALUES (
    v_listing.id, v_app.id, v_listing.owner_id, v_app.worker_id,
    v_listing.title, v_listing.price, v_listing.commission_type, v_listing.commission_value, v_listing.commission_terms
  )
  RETURNING id INTO v_deal_id;

  INSERT INTO public.deal_events (deal_id, actor_id, event_type, note)
  VALUES (v_deal_id, auth.uid(), 'created', 'تم قبول المتقدم وتوثيق الاتفاق');

  RETURN v_deal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_application(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.applications%ROWTYPE;
  v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_app FROM public.applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT owner_id INTO v_owner FROM public.listings WHERE id = v_app.listing_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'application_not_pending' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.applications SET status = 'rejected' WHERE id = v_app.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_application(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.applications%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_app FROM public.applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_app.worker_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'application_not_pending' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.applications SET status = 'withdrawn' WHERE id = v_app.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_deal(p_deal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal public.deals%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'deal_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_deal.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_deal.status <> 'active' THEN
    RAISE EXCEPTION 'deal_not_active' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.deals SET status = 'completed', completed_at = now() WHERE id = v_deal.id;

  INSERT INTO public.deal_events (deal_id, actor_id, event_type, note)
  VALUES (v_deal.id, auth.uid(), 'completed', 'تم إتمام الاتفاق من صاحب الفرصة');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_application(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_application(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.withdraw_application(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_deal(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.accept_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_deal(uuid) TO authenticated;
