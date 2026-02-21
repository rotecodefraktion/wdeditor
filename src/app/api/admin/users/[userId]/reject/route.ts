import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendRejectionEmail } from '@/lib/email'

const ParamsSchema = z.object({
  userId: z.string().uuid('Ungueltige User-ID'),
})

const RejectSchema = z.object({
  reason: z.string().max(500).optional(),
})

export async function POST(
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

  // Body parsen
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const result = RejectSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Ungueltige Begruendung' }, { status: 400 })
  }

  // Ziel-User pruefen
  const { data: targetProfile } = await supabase
    .from('user_profiles')
    .select('status, full_name')
    .eq('user_id', userId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })
  }

  if (!['pending_approval', 'active'].includes(targetProfile.status)) {
    return NextResponse.json(
      { error: `User im Status '${targetProfile.status}' kann nicht abgelehnt werden` },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      status: 'rejected',
      rejection_reason: result.data.reason ?? null,
    })
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
      action: 'reject',
      details: { previous_status: targetProfile.status, reason: result.data.reason ?? null },
    })
  } catch (auditError) {
    console.error('[reject] Failed to write audit log:', auditError)
  }

  // BUG-3: Send rejection notification email via Resend
  try {
    const { data: authUser } = await adminClient.auth.admin.getUserById(userId)
    if (authUser?.user?.email) {
      await sendRejectionEmail(
        authUser.user.email,
        targetProfile.full_name ?? '',
        result.data.reason
      )
    }
  } catch (emailError) {
    // Log but do not fail the rejection if email sending fails
    console.error('[reject] Failed to send rejection email:', emailError)
  }

  return NextResponse.json({ message: 'User erfolgreich abgelehnt' })
}
