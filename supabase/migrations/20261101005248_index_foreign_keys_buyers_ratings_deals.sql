/*
# Index foreign keys on buyers, deal ratings and deals

1. Changes
- Adds an index on `buyers.application_id`, used when looking up a marketer's application.
- Adds an index on `deal_ratings.rater_id`, used when checking whether a party already rated.
- Adds an index on `deals.listing_id`, used when showing a listing's deals.

2. Security
- No changes to access rules, grants, or policies.

3. Notes
- Indexes only; no data is changed. Safe to re-run.
*/

CREATE INDEX IF NOT EXISTS buyers_application_id_idx ON buyers (application_id);
CREATE INDEX IF NOT EXISTS deal_ratings_rater_id_idx ON deal_ratings (rater_id);
CREATE INDEX IF NOT EXISTS deals_listing_id_idx ON deals (listing_id);
