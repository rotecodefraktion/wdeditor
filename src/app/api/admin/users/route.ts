import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const QuerySchema = z.object({
  status: z
    .enum(['unconfirmed', 'pending_approval', 'active', 'rejected', 'deactivated'])
    .optional(),
})

export async function GET(request: Request) {
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

  // Query-Parameter parsen
  const { searchParams } = new URL(request.url)
  const queryResult = QuerySchema.safeParse({ status: searchParams.get('status') ?? undefined })
  if (!queryResult.success) {
    return NextResponse.json({ error: 'Ungueltiger Status-Filter' }, { status: 400 })
  }

  let query = supabase
    .from('user_profiles')
    .select('user_id, github_username, full_name, status, role, rejection_reason, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (queryResult.data.status) {
    query = query.eq('status', queryResult.data.status)
  }

  const { data: profiles, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // BUG-2 fix: Merge email addresses from auth.users via admin API
  const adminClient = createAdminClient()
  const { data: authUsersData, error: authError2 } = await adminClient.auth.admin.listUsers({
    perPage: 1000,
  })

  if (authError2) {
    console.error('[admin/users] Failed to list auth users:', authError2)
    // Return profiles without emails rather than failing entirely
    return NextResponse.json({ users: profiles })
  }

  // Build lookup map: user_id -> { email, last_sign_in_at }
  const authDataMap = new Map<string, { email: string | null; last_sign_in_at: string | null }>()
  for (const authUser of authUsersData.users) {
    authDataMap.set(authUser.id, {
      email: authUser.email ?? null,
      last_sign_in_at: authUser.last_sign_in_at ?? null,
    })
  }

  // Merge email and last_sign_in_at into each profile
  const usersWithEmail = (profiles ?? []).map((profile) => {
    const authData = authDataMap.get(profile.user_id)
    return {
      ...profile,
      email: authData?.email ?? null,
      last_sign_in_at: authData?.last_sign_in_at ?? null,
    }
  })

  return NextResponse.json({ users: usersWithEmail })
}
