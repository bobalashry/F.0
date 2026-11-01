/*
# Mutual 5-star ratings after completed deals

1. New table `deal_ratings`
- One row per party per completed deal (rater, ratee, stars 1-5, optional comment up to 500 characters).
- Unique per (deal, rater), so each party rates once.
- Admin can hide a rating with a reason (`is_hidden`); hidden ratings are excluded from averages.

2. Security
- RLS enabled. No direct table access for browsers: ratings are written by `submit_deal_rating` and read by `get_deal_ratings`, which reveal the other party's rating only after the caller has rated too (blind mutual review).
- `get_profile_rating_summary` returns only the average and count of visible ratings, never comments or rater identities.
- Writes require an active account and a completed deal the caller belongs to.

3. Notes
- Ratings are never updated or deleted by users.
*/

CREATE TABLE IF NOT EXISTS public.deal_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
  rater_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ratee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 500),
  is_hidden boolean NOT NULL DEFAULT false,
  hidden_reason text CHECK (hidden_reason IS NULL OR char_length(hidden_reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_ratings_one_per_rater UNIQUE (deal_id, rater_id),
  CONSTRAINT deal_ratings_not_self CHECK (rater_id <> ratee_id)
);

CREATE INDEX IF NOT EXISTS deal_ratings_ratee_id_idx ON public.deal_ratings (ratee_id);

ALTER TABLE public.deal_ratings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.submit_deal_rating(p_deal_id uuid, p_stars integer, p_comment text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_deal public.deals%ROWTYPE;
  v_ratee uuid;
  v_comment text := NULLIF(btrim(coalesce(p_comment, '')), '');
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_account_active() THEN
    RAISE EXCEPTION 'account_not_active' USING ERRCODE = '42501';
  END IF;

  IF p_stars IS NULL OR p_stars < 1 OR p_stars > 5 THEN
    RAISE EXCEPTION 'invalid_stars' USING ERRCODE = 'P0001';
  END IF;

  IF v_comment IS NOT NULL AND char_length(v_comment) > 500 THEN
    RAISE EXCEPTION 'comment_too_long' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'deal_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_deal.status <> 'completed' THEN
    RAISE EXCEPTION 'deal_not_completed' USING ERRCODE = 'P0001';
  END IF;

  IF auth.uid() = v_deal.owner_id THEN
    v_ratee := v_deal.worker_id;
  ELSIF auth.uid() = v_deal.worker_id THEN
    v_ratee := v_deal.owner_id;
  ELSE
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  BEGIN
    INSERT INTO public.deal_ratings (deal_id, rater_id, ratee_id, stars, comment)
    VALUES (p_deal_id, auth.uid(), v_ratee, p_stars::smallint, v_comment)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'already_rated' USING ERRCODE = 'P0001';
  END;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_deal_ratings(p_deal_id uuid)
RETURNS TABLE (
  rater_id uuid,
  ratee_id uuid,
  stars smallint,
  comment text,
  created_at timestamptz,
  is_mine boolean,
  counterpart_visible boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_i_have_rated boolean;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.deals d WHERE d.id = p_deal_id AND (d.owner_id = v_me OR d.worker_id = v_me)
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.deal_ratings r WHERE r.deal_id = p_deal_id AND r.rater_id = v_me
  ) INTO v_i_have_rated;

  RETURN QUERY
  SELECT
    r.rater_id,
    r.ratee_id,
    CASE WHEN r.rater_id = v_me OR v_i_have_rated THEN r.stars ELSE NULL END,
    CASE WHEN r.rater_id = v_me OR v_i_have_rated THEN r.comment ELSE NULL END,
    r.created_at,
    (r.rater_id = v_me),
    v_i_have_rated
  FROM public.deal_ratings r
  WHERE r.deal_id = p_deal_id
    AND (r.rater_id = v_me OR r.ratee_id = v_me)
    AND (r.rater_id = v_me OR v_i_have_rated);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_profile_rating_summary(p_user_id uuid)
RETURNS TABLE (average_stars numeric, rating_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    round(avg(r.stars)::numeric, 1),
    count(*)::integer
  FROM public.deal_ratings r
  WHERE r.ratee_id = p_user_id AND NOT r.is_hidden;
$function$;

REVOKE EXECUTE ON FUNCTION public.submit_deal_rating(uuid, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_deal_ratings(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_profile_rating_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_deal_rating(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_deal_ratings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_rating_summary(uuid) TO authenticated;
