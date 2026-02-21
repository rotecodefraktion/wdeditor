import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ParamsSchema = z.object({
  userId: z.string().uuid('Ungueltige User-ID'),
})

const RoleSchema = z.object({
  role: z.enum(['user', 'admin', 'super_admin']),
})

export async function PATCH(
  request: Request,
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

  // Only super_admin can change roles
  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Nur Super-Admins duerfen Rollen aendern' }, { status: 403 })
  }

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 })
  }

  const result = RoleSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Ungueltige Rolle' }, { status: 400 })
  }

  const newRole = result.data.role

  // Cannot change own role
  if (userId === user.id) {
    return NextResponse.json(
      { error: 'Du kannst deine eigene Rolle nicht aendern' },
      { status: 409 }
    )
  }

  // Check target user exists
  const { data: targetProfile } = await supabase
    .from('user_profiles')
    .select('role, status')
    .eq('user_id', userId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })
  }

  // If demoting a super_admin, check we keep at least one
  if (targetProfile.role === 'super_admin' && newRole !== 'super_admin') {
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
    .update({ role: newRole })
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // BUG-PROJ3-7: Log admin action to audit log
  try {
    const adminClient = createAdminClient()
    await adminClient.from('admin_audit_log').insert({
      admin_user_id: user.id,
      target_user_id: userId,
      action: 'role_change',
      details: { previous_role: targetProfile.role, new_role: newRole },
    })
  } catch (auditError) {
    console.error('[role] Failed to write audit log:', auditError)
  }

  return NextResponse.json({ message: 'Rolle erfolgreich geaendert' })
}
