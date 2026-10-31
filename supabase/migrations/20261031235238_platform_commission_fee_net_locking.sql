/*
# Platform commission fee (10%) with locked net amounts

1. Schema
- deals.worker_commission_amount: the marketer's net commission, fixed when the application is accepted.
- deal_financials: one row per deal with the total commission, platform fee percent and amount, and the marketer's net.
  Only the deal owner can read it. The marketer never gets this table.

2. Calculation (server side)
- Total commission: fixed value, or listing price times the percentage.
- Platform fee: 10% of the total, rounded to 2 decimals. Marketer net = total minus fee.

3. Acceptance
- accept_application computes and stores these amounts in the same transaction as the deal, so later listing edits do not change them.

4. Backfill
- Existing deals (if any) get the same breakdown from their stored price and commission snapshot.
*/

CREATE OR REPLACE FUNCTION public.commission_total_amount(p_type text, p_value numeric, p_price numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT round(CASE WHEN p_type = 'percentage' THEN p_price * p_value / 100 ELSE p_value END, 2)
$function$;

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS worker_commission_amount numeric(12, 2);

CREATE TABLE IF NOT EXISTS public.deal_financials (
  deal_id uuid PRIMARY KEY REFERENCES public.deals(id) ON DELETE CASCADE,
  commission_total numeric(12, 2) NOT NULL CHECK (commission_total >= 0),
  platform_fee_percent numeric(5, 2) NOT NULL DEFAULT 10 CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 100),
  platform_fee_amount numeric(12, 2) NOT NULL CHECK (platform_fee_amount >= 0),
  worker_commission_amount numeric(12, 2) NOT NULL CHECK (worker_commission_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (platform_fee_amount + worker_commission_amount = commission_total)
);

ALTER TABLE public.deal_financials ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.deal_financials TO authenticated;

CREATE POLICY "select_owner_deal_financials" ON public.deal_financials
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = deal_financials.deal_id AND d.owner_id = auth.uid()
  ));

INSERT INTO public.deal_financials (deal_id, commission_total, platform_fee_amount, worker_commission_amount)
SELECT d.id, t.total, f.fee, t.total - f.fee
FROM public.deals d
CROSS JOIN LATERAL (SELECT public.commission_total_amount(d.commission_type, d.commission_value, d.listing_price) AS total) t
CROSS JOIN LATERAL (SELECT round(t.total * 10 / 100, 2) AS fee) f
WHERE NOT EXISTS (SELECT 1 FROM public.deal_financials x WHERE x.deal_id = d.id);

UPDATE public.deals d
SET worker_commission_amount = f.worker_commission_amount
FROM public.deal_financials f
WHERE f.deal_id = d.id AND d.worker_commission_amount IS NULL;

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
v_total numeric(12, 2);
v_fee numeric(12, 2);
v_net numeric(12, 2);
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

v_total := public.commission_total_amount(v_listing.commission_type, v_listing.commission_value, v_listing.price);
v_fee := round(v_total * 10 / 100, 2);
v_net := v_total - v_fee;

UPDATE public.applications SET status = 'accepted' WHERE id = v_app.id;

INSERT INTO public.deals (
listing_id, application_id, owner_id, worker_id,
listing_title, listing_price, commission_type, commission_value, commission_terms, worker_commission_amount
)
VALUES (
v_listing.id, v_app.id, v_listing.owner_id, v_app.worker_id,
v_listing.title, v_listing.price, v_listing.commission_type, v_listing.commission_value, v_listing.commission_terms, v_net
)
RETURNING id INTO v_deal_id;

INSERT INTO public.deal_financials (deal_id, commission_total, platform_fee_percent, platform_fee_amount, worker_commission_amount)
VALUES (v_deal_id, v_total, 10, v_fee, v_net);

INSERT INTO public.deal_events (deal_id, actor_id, event_type, note)
VALUES (v_deal_id, auth.uid(), 'created', 'تم قبول المتقدم وتوثيق الاتفاق');

RETURN v_deal_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.commission_total_amount(text, numeric, numeric) FROM PUBLIC, anon;
