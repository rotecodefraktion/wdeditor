-- =============================================================
-- PROJ-3: Admin Audit Log
-- Tracks all admin actions for accountability and traceability.
-- =============================================================

-- 1. Create enum type for admin actions
CREATE TYPE public.admin_action AS ENUM (
  'approve',
  'reject',
  'deactivate',
  'reactivate',
  'role_change'
);

-- 2. Create admin_audit_log table
CREATE TABLE public.admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        public.admin_action NOT NULL,
  details       JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for common queries
CREATE INDEX idx_audit_log_admin_user_id ON public.admin_audit_log(admin_user_id);
CREATE INDEX idx_audit_log_target_user_id ON public.admin_audit_log(target_user_id);
CREATE INDEX idx_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX idx_audit_log_created_at ON public.admin_audit_log(created_at DESC);

-- 4. Enable Row Level Security
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- SELECT: Only admins and super_admins can view the audit log
CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles AS p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- No INSERT policy: audit log entries are only inserted via the service role
-- (adminClient) from API routes. This prevents any client-side tampering.

-- No UPDATE policy: audit log entries are immutable.

-- No DELETE policy: audit log entries cannot be deleted by any user.
