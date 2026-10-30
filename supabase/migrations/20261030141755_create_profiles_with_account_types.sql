/*
# Create profiles with fixed account types

Plain-English summary:
Every person who signs up gets a profile that stores their display name, governorate and account type. The account type is either "worker" (looking for opportunities) or "owner" (publishes opportunities). The type is chosen at sign-up and cannot be changed by the user afterwards.

## 1. New tables
- `profiles`
  - `id` (uuid, primary key, same as the sign-in account id)
  - `account_type` (text: 'worker' or 'owner', fixed after creation)
  - `full_name` (text, 2 to 80 characters)
  - `governorate` (text, optional)
  - `created_at`, `updated_at`

## 2. Automation
- A trigger creates a profile automatically when a new sign-in account is created. Invalid or missing account types fall back to 'worker'.

## 3. Security
- Row level security enabled on `profiles`.
- Signed-in users can read profile names and types (needed to show owner and applicant names). Profiles are not readable by anonymous visitors.
- Users can only update their own `full_name` and `governorate`. `account_type` is not writable by any client role.
- No client can insert or delete profiles directly.

## 4. Important notes
1. Account type changes must go through the admin team; the database does not allow direct changes.
2. The trigger function is not callable by clients.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type text NOT NULL CHECK (account_type IN ('worker', 'owner')),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 80),
  governorate text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT (id, account_type, full_name, governorate) ON public.profiles TO authenticated;
GRANT UPDATE (full_name, governorate) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "select_profiles" ON public.profiles;
CREATE POLICY "select_profiles" ON public.profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
  TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_name text;
BEGIN
  v_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'worker');
  IF v_type NOT IN ('worker', 'owner') THEN
    v_type := 'worker';
  END IF;

  v_name := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''), 'مستخدم جديد');

  INSERT INTO public.profiles (id, account_type, full_name, governorate)
  VALUES (
    NEW.id,
    v_type,
    v_name,
    NULLIF(btrim(NEW.raw_user_meta_data->>'governorate'), '')
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
