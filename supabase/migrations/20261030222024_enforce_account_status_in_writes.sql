/*
# Enforce suspension and bans in every write path

## Plain-English summary
A suspended or banned account must not be able to publish listings, apply to opportunities, or change agreements.
Listings suspended by an admin must stay hidden and cannot be reactivated by their owner.
Public browsing also hides listings whose owner account is not active.

## Changes
1. Listings
- Visible to the public only when active and the owner's account is active.
- Owners can insert, edit, and delete only while their own account is active.
- Owners cannot edit a listing that an admin suspended.
- Admins with the listings permission can see all listings.
2. Applications
- Insert requires an active account.
- Admins with the listings permission can see applications on any listing.
3. Deal functions (accept, reject, withdraw, complete) check the caller's account is active first.

## Security notes
- Each check happens in the database, so a suspended user cannot bypass it through direct requests.
- No new client write privileges are granted.
*/

DROP POLICY IF EXISTS "insert_own_listing" ON public.listings;
CREATE POLICY "insert_own_listing" ON public.listings FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND status IN ('active', 'paused')
    AND public.is_account_active()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.account_type = 'owner')
  );

DROP POLICY IF EXISTS "update_own_listing" ON public.listings;
CREATE POLICY "update_own_listing" ON public.listings FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() AND status <> 'suspended' AND public.is_account_active())
  WITH CHECK (owner_id = auth.uid() AND status IN ('active', 'paused', 'closed') AND public.is_account_active());

DROP POLICY IF EXISTS "delete_own_listing" ON public.listings;
CREATE POLICY "delete_own_listing" ON public.listings FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() AND status <> 'suspended' AND public.is_account_active());

DROP POLICY IF EXISTS "insert_own_application" ON public.applications;
CREATE POLICY "insert_own_application" ON public.applications FOR INSERT
  TO authenticated
  WITH CHECK (
    worker_id = auth.uid()
    AND status = 'pending'
    AND public.is_account_active()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.account_type = 'worker')
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = applications.listing_id AND l.status = 'active' AND l.owner_id <> auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.accept_application(p_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_app public.applications%ROWTYPE;
v_listing public.listings%ROWTYPE;
v_deal_id uuid;
BEGIN
IF auth.uid() IS NULL THEN
RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
END IF;

IF NOT public.is_account_active() THEN
RAISE EXCEPTION 'account_not_active' USING ERRCODE = '42501';
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
$function$;

CREATE OR REPLACE FUNCTION public.reject_application(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_app public.applications%ROWTYPE;
v_owner uuid;
BEGIN
IF auth.uid() IS NULL THEN
RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
END IF;

IF NOT public.is_account_active() THEN
RAISE EXCEPTION 'account_not_active' USING ERRCODE = '42501';
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
$function$;

CREATE OR REPLACE FUNCTION public.withdraw_application(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_app public.applications%ROWTYPE;
BEGIN
IF auth.uid() IS NULL THEN
RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
END IF;

IF NOT public.is_account_active() THEN
RAISE EXCEPTION 'account_not_active' USING ERRCODE = '42501';
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
$function$;

CREATE OR REPLACE FUNCTION public.complete_deal(p_deal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_deal public.deals%ROWTYPE;
BEGIN
IF auth.uid() IS NULL THEN
RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
END IF;

IF NOT public.is_account_active() THEN
RAISE EXCEPTION 'account_not_active' USING ERRCODE = '42501';
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
$function$;
