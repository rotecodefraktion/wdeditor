import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/settings/settings-form'
import { ActiveLockWarning } from '@/components/settings/active-lock-warning'

export const metadata = {
  title: 'Global Settings - SAP Web Dispatcher Editor',
}

export default async function SettingsPage() {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Role check -- only admins and super_admins can access settings
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Check for active file locks (PROJ-5/6 context)
  // The file_locks table may not exist yet, so we handle errors gracefully
  let activeLockCount = 0
  try {
    const { count } = await supabase
      .from('file_locks')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', new Date().toISOString())

    activeLockCount = count ?? 0
  } catch {
    // Table may not exist yet (PROJ-5/6 not built) -- that's fine
    activeLockCount = 0
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Global Settings</h1>
        <p className="text-muted-foreground">
          Configure the GitHub repository, authentication, and file paths for
          the configuration editors.
        </p>
      </div>

      {activeLockCount > 0 && (
        <ActiveLockWarning lockCount={activeLockCount} />
      )}

      <div className="card-premium relative overflow-hidden p-6">
        <div className="absolute top-0 bottom-0 left-0 w-1 consolut-gradient-v" />
        <SettingsForm />
      </div>
    </div>
  )
}
