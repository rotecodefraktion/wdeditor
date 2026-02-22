-- =============================================================
-- PROJ-4: app_settings table (single-row, global config)
-- =============================================================

-- 1. Create app_settings table
CREATE TABLE public.app_settings (
  id                      UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  github_repo             TEXT,
  github_pat_encrypted    TEXT,
  github_pat_hint         TEXT,
  dev_branch              TEXT NOT NULL DEFAULT 'dev',
  instance_profile_path   TEXT,
  rules_txt_path          TEXT,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Ensure only one row can ever exist (singleton pattern)
CREATE UNIQUE INDEX idx_app_settings_singleton ON public.app_settings ((true));

-- 3. Enable Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- SELECT: Only admins and super_admins can read settings
CREATE POLICY "Admins can view settings"
  ON public.app_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles AS p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- INSERT: Only admins and super_admins can insert settings
CREATE POLICY "Admins can insert settings"
  ON public.app_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles AS p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- UPDATE: Only admins and super_admins can update settings
CREATE POLICY "Admins can update settings"
  ON public.app_settings
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

-- DELETE: Nobody can delete the settings row
-- (No DELETE policy = no one can delete via RLS)

-- 5. Note: The settings status check (/api/settings/status) uses the
--    admin/service-role client to bypass RLS and returns only a boolean.
--    No broad SELECT policy is needed for non-admin users.
--    This keeps the encrypted PAT column protected by RLS at all times.
