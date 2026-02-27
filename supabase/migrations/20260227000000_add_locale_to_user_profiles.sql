-- =============================================================
-- PROJ-9: Add locale column to user_profiles for i18n
-- =============================================================

-- 1. Add locale column with default 'de' and CHECK constraint
ALTER TABLE public.user_profiles
  ADD COLUMN locale TEXT NOT NULL DEFAULT 'de'
  CHECK (locale IN ('de', 'en', 'pt'));

-- 2. Index on locale for potential filtering/grouping
CREATE INDEX idx_user_profiles_locale ON public.user_profiles(locale);

-- 3. RLS Policy: Allow users to update their own locale
--    Note: Supabase RLS cannot restrict individual columns, so the API
--    endpoint enforces that only the locale column is updated.
--    This policy allows users to update their own row.
CREATE POLICY "Users can update own locale"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
