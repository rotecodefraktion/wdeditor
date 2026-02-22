-- =============================================================
-- PROJ-4 fix: Remove overly broad SELECT policy on app_settings
-- =============================================================
-- The "Authenticated users can check settings status" policy
-- allowed ALL authenticated users to read ALL columns, including
-- github_pat_encrypted. The /api/settings/status endpoint now
-- uses the admin/service-role client instead, so this policy
-- is no longer needed and must be removed for security.
-- =============================================================

DROP POLICY IF EXISTS "Authenticated users can check settings status"
  ON public.app_settings;
