/*
# Fix mutable search_path on account status helpers

1. Changed functions
- is_account_active() and is_profile_active(uuid): pinned search_path to public.

2. Why
- Without a fixed search_path, a function can resolve names from another schema. These helpers gate RLS and RPCs.
*/

ALTER FUNCTION public.is_account_active() SET search_path = public;
ALTER FUNCTION public.is_profile_active(uuid) SET search_path = public;
