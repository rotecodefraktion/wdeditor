import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ParamsSchema = z.object({
  userId: z.string().uuid('Ungueltige User-ID'),
})

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const rawParams = await params

  // BUG-10: Validate userId is a valid UUID
  const paramsResult = ParamsSchema.safeParse(rawParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: 'Ungueltige User-ID' }, { status: 400 })
  }
  const { userId } = paramsResult.data

  const supabase = await createClient()

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  // Role check
  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!callerProfile || !['admin', 'super_admin'].includes(callerProfile.role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Cannot deactivate yourself
  if (userId === user.id) {
    return NextResponse.json(
      { error: 'Du kannst deinen eigenen Account nicht deaktivieren' },
      { status: 409 }
    )
  }

  // Check target user
  const { data: targetProfile } = await supabase
    .from('user_profiles')
    .select('status, role')
    .eq('user_id', userId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })
  }

  if (targetProfile.status !== 'active') {
    return NextResponse.json(
      { error: `User ist im Status '${targetProfile.status}' und kann nicht deaktiviert werden` },
      { status: 409 }
    )
  }

  // Block deactivation of the last super_admin
  if (targetProfile.role === 'super_admin') {
    const { count } = await supabase
      .from('user_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('role', 'super_admin')
      .eq('status', 'active')

    if (count !== null && count <= 1) {
      return NextResponse.json(
        { error: 'Mindestens ein Super-Admin muss aktiv bleiben' },
        { status: 409 }
      )
    }
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ status: 'deactivated' })
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // BUG-PROJ3-7: Log admin action to audit log
  const adminClient = createAdminClient()
  try {
    await adminClient.from('admin_audit_log').insert({
      admin_user_id: user.id,
      target_user_id: userId,
      action: 'deactivate',
      details: { previous_status: targetProfile.status },
    })
  } catch (auditError) {
    console.error('[deactivate] Failed to write audit log:', auditError)
  }

  // BUG-11: Invalidate active sessions for the deactivated user
  try {
    await adminClient.auth.admin.signOut(userId)
  } catch (signOutError) {
    // Log but do not fail the deactivation
    console.error('[deactivate] Failed to invalidate user sessions:', signOutError)
  }

  return NextResponse.json({ message: 'User erfolgreich deaktiviert' })
}
