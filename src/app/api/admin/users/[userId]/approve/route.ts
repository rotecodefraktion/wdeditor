import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendApprovalEmail } from '@/lib/email'

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

  // Auth pruefen
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  // Rolle pruefen
  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!callerProfile || !['admin', 'super_admin'].includes(callerProfile.role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Ziel-User muss pending_approval sein
  const { data: targetProfile } = await supabase
    .from('user_profiles')
    .select('status, full_name')
    .eq('user_id', userId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })
  }

  if (targetProfile.status !== 'pending_approval') {
    return NextResponse.json(
      { error: `User ist im Status '${targetProfile.status}' und kann nicht genehmigt werden` },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ status: 'active', rejection_reason: null })
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
      action: 'approve',
      details: { previous_status: targetProfile.status },
    })
  } catch (auditError) {
    console.error('[approve] Failed to write audit log:', auditError)
  }

  // BUG-3: Send approval notification email via Resend
  try {
    const { data: authUser } = await adminClient.auth.admin.getUserById(userId)
    if (authUser?.user?.email) {
      await sendApprovalEmail(
        authUser.user.email,
        targetProfile.full_name ?? ''
      )
    }
  } catch (emailError) {
    // Log but do not fail the approval if email sending fails
    console.error('[approve] Failed to send approval email:', emailError)
  }

  return NextResponse.json({ message: 'User erfolgreich genehmigt' })
}
