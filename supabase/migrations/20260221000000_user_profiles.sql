-- =============================================================
-- PROJ-1 / PROJ-2: user_profiles table, triggers, RLS policies
-- =============================================================

-- 1. Create user_profiles table
CREATE TABLE public.user_profiles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_username TEXT NOT NULL UNIQUE,
  full_name  TEXT,
  status     TEXT NOT NULL DEFAULT 'unconfirmed'
    CHECK (status IN ('unconfirmed', 'pending_approval', 'active', 'rejected', 'deactivated')),
  role       TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'super_admin')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for frequently queried columns
CREATE INDEX idx_user_profiles_status ON public.user_profiles(status);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_user_profiles_github_username ON public.user_profiles(github_username);
CREATE INDEX idx_user_profiles_created_at ON public.user_profiles(created_at DESC);

-- 3. Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Trigger: on_new_user
--    Creates a user_profiles row when a new auth.users row is inserted.
--    First user in the system gets role=super_admin and status=active.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  new_role TEXT;
  new_status TEXT;
  gh_username TEXT;
  user_full_name TEXT;
BEGIN
  -- Count existing profiles to determine if this is the first user
  SELECT COUNT(*) INTO user_count FROM public.user_profiles;

  IF user_count = 0 THEN
    new_role := 'super_admin';
    new_status := 'active';
  ELSE
    new_role := 'user';
    new_status := 'unconfirmed';
  END IF;

  -- Extract github_username and full_name from user metadata
  gh_username := COALESCE(
    NEW.raw_user_meta_data ->> 'github_username',
    NEW.raw_user_meta_data ->> 'user_name',
    'unknown'
  );
  user_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    ''
  );

  INSERT INTO public.user_profiles (user_id, github_username, full_name, status, role)
  VALUES (NEW.id, gh_username, user_full_name, new_status, new_role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Trigger: on_email_confirmed
--    Sets status to pending_approval when email_confirmed_at changes from NULL.
--    Skips if user is already active (first super_admin).
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.user_profiles
    SET status = 'pending_approval'
    WHERE user_id = NEW.id
      AND status = 'unconfirmed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_confirmed();

-- 6. Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- SELECT: Users can see their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- SELECT: Admins and super_admins can see all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles AS p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- INSERT: Only the system (via trigger with SECURITY DEFINER) inserts profiles.
-- No direct INSERT allowed for authenticated users.
-- The trigger runs as SECURITY DEFINER so it bypasses RLS.

-- UPDATE: Only admins and super_admins can update profiles
CREATE POLICY "Admins can update profiles"
  ON public.user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles AS p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles AS p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- DELETE: Only super_admins can delete profiles (not used in app, but secured)
CREATE POLICY "Super admins can delete profiles"
  ON public.user_profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles AS p
      WHERE p.user_id = auth.uid()
        AND p.role = 'super_admin'
    )
  );
