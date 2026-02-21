import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReactivationEmail } from '@/lib/email'

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

  // Check target user
  const { data: targetProfile } = await supabase
    .from('user_profiles')
    .select('status, full_name')
    .eq('user_id', userId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })
  }

  if (targetProfile.status !== 'deactivated') {
    return NextResponse.json(
      { error: `User ist im Status '${targetProfile.status}' und kann nicht reaktiviert werden` },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ status: 'active' })
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
      action: 'reactivate',
      details: { previous_status: targetProfile.status },
    })
  } catch (auditError) {
    console.error('[reactivate] Failed to write audit log:', auditError)
  }

  // BUG-PROJ3-6: Send reactivation notification email
  try {
    const { data: authUser } = await adminClient.auth.admin.getUserById(userId)
    if (authUser?.user?.email) {
      await sendReactivationEmail(
        authUser.user.email,
        targetProfile.full_name ?? ''
      )
    }
  } catch (emailError) {
    // Log but do not fail the reactivation if email sending fails
    console.error('[reactivate] Failed to send reactivation email:', emailError)
  }

  return NextResponse.json({ message: 'User erfolgreich reaktiviert' })
}
