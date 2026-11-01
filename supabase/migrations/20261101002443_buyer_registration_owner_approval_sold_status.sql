/*
# Buyer registration, owner approval, sold status, and optional application message

1. Listings
- New status 'sold'. Set only through mark_listing_sold(); the owner's direct update cannot set it.
- Sold listings are read-only for the owner and no longer appear in the public listings.

2. Applications
- The introductory message is optional (up to 1000 characters).

3. Buyers
- A buyer is registered by an accepted marketer on an active listing, with consent confirmed.
- The buyer's reference number is generated on registration.
- The owner accepts the buyer or objects with evidence. Acceptance starts a 60-day protection period.
- A buyer phone number can be registered only once per listing (duplicate and fake registrations are blocked).
- Only the owner and the registering marketer can read a buyer. Writes happen only through functions.
*/

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'closed'::text, 'suspended'::text, 'sold'::text]));

DROP POLICY IF EXISTS update_own_listing ON public.listings;
CREATE POLICY update_own_listing ON public.listings
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND status <> 'suspended' AND status <> 'sold' AND is_account_active())
  WITH CHECK (owner_id = auth.uid() AND status = ANY (ARRAY['active'::text, 'paused'::text, 'closed'::text]) AND is_account_active());

ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_message_check;
ALTER TABLE public.applications ADD CONSTRAINT applications_message_check CHECK (char_length(message) <= 1000);

CREATE TABLE IF NOT EXISTS public.buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text NOT NULL UNIQUE DEFAULT (
    'BYR-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE RESTRICT,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  buyer_name text NOT NULL CHECK (char_length(buyer_name) BETWEEN 3 AND 120),
  buyer_phone text NOT NULL CHECK (buyer_phone ~ '^01[0125][0-9]{8}$'),
  consent_confirmed_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'objected')),
  objection_evidence text CHECK (objection_evidence IS NULL OR char_length(objection_evidence) BETWEEN 10 AND 2000),
  decided_at timestamptz,
  protection_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyers_one_per_phone_per_listing UNIQUE (listing_id, buyer_phone),
  CONSTRAINT buyers_accepted_has_protection CHECK ((status = 'accepted') = (protection_ends_at IS NOT NULL)),
  CONSTRAINT buyers_objected_has_evidence CHECK ((status = 'objected') = (objection_evidence IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS buyers_worker_id_idx ON public.buyers (worker_id);
CREATE INDEX IF NOT EXISTS buyers_owner_id_idx ON public.buyers (owner_id);

ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.buyers TO authenticated;

CREATE POLICY select_related_buyers ON public.buyers
  FOR SELECT TO authenticated
  USING (worker_id = auth.uid() OR owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.register_buyer(
  p_listing_id uuid,
  p_buyer_name text,
  p_buyer_phone text,
  p_consent boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_listing public.listings%ROWTYPE;
  v_application_id uuid;
  v_name text := btrim(coalesce(p_buyer_name, ''));
  v_phone text := regexp_replace(coalesce(p_buyer_phone, ''), '\s', '', 'g');
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_account_active() THEN
    RAISE EXCEPTION 'account_not_active' USING ERRCODE = '42501';
  END IF;

  IF p_consent IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'consent_required' USING ERRCODE = 'P0001';
  END IF;

  IF char_length(v_name) < 3 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'invalid_buyer_name' USING ERRCODE = 'P0001';
  END IF;

  IF v_phone !~ '^01[0125][0-9]{8}$' THEN
    RAISE EXCEPTION 'invalid_buyer_phone' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_listing.status <> 'active' THEN
    RAISE EXCEPTION 'listing_not_active' USING ERRCODE = 'P0001';
  END IF;

  SELECT a.id INTO v_application_id
  FROM public.applications a
  WHERE a.listing_id = p_listing_id AND a.worker_id = auth.uid() AND a.status = 'accepted';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.buyers b WHERE b.listing_id = p_listing_id AND b.buyer_phone = v_phone) THEN
    RAISE EXCEPTION 'buyer_already_registered' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.buyers (
      listing_id, application_id, owner_id, worker_id, buyer_name, buyer_phone, consent_confirmed_at
    )
    VALUES (
      p_listing_id, v_application_id, v_listing.owner_id, auth.uid(), v_name, v_phone, now()
    )
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'buyer_already_registered' USING ERRCODE = 'P0001';
  END;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decide_buyer(p_buyer_id uuid, p_decision text, p_evidence text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_buyer public.buyers%ROWTYPE;
  v_evidence text := btrim(coalesce(p_evidence, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_account_active() THEN
    RAISE EXCEPTION 'account_not_active' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_buyer FROM public.buyers WHERE id = p_buyer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'buyer_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_buyer.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_buyer.status <> 'pending' THEN
    RAISE EXCEPTION 'buyer_not_pending' USING ERRCODE = 'P0001';
  END IF;

  IF p_decision = 'accept' THEN
    UPDATE public.buyers
    SET status = 'accepted', decided_at = now(), protection_ends_at = now() + interval '60 days'
    WHERE id = v_buyer.id;
  ELSIF p_decision = 'object' THEN
    IF char_length(v_evidence) < 10 THEN
      RAISE EXCEPTION 'evidence_required' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.buyers
    SET status = 'objected', decided_at = now(), objection_evidence = v_evidence
    WHERE id = v_buyer.id;
  ELSE
    RAISE EXCEPTION 'invalid_decision' USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_listing_sold(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_listing public.listings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_account_active() THEN
    RAISE EXCEPTION 'account_not_active' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_listing.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_listing.status NOT IN ('active', 'paused') THEN
    RAISE EXCEPTION 'listing_cannot_be_sold' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.listings SET status = 'sold' WHERE id = v_listing.id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.register_buyer(uuid, text, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decide_buyer(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_listing_sold(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_buyer(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_buyer(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_listing_sold(uuid) TO authenticated;
