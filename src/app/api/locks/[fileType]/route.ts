import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { checkOrigin } from '@/lib/csrf'

const VALID_FILE_TYPES = ['instance_profile', 'rules']
const LOCK_TIMEOUT_MINUTES = 30

/** Rate limits per endpoint */
const GET_RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 }
const DELETE_RATE_LIMIT = { maxRequests: 20, windowMs: 60_000 }
const BEACON_RATE_LIMIT = { maxRequests: 20, windowMs: 60_000 }

/**
 * Shared helper for releasing a lock (used by both DELETE and POST/sendBeacon handlers).
 *
 * - Authenticates the user
 * - Validates the fileType
 * - Looks up the current lock
 * - Lock owner can always release; admins can release expired locks
 * - Returns a NextResponse with the result
 */
async function releaseLock(fileType: string): Promise<NextResponse> {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!VALID_FILE_TYPES.includes(fileType)) {
    return NextResponse.json(
      { error: 'Invalid file type' },
      { status: 400 }
    )
  }

  // Get the current lock
  const { data: lock } = await supabase
    .from('file_locks')
    .select('id, locked_by, heartbeat_at')
    .eq('file_type', fileType)
    .single()

  if (!lock) {
    return NextResponse.json({ success: true, message: 'No lock exists' })
  }

  const isOwnLock = lock.locked_by === user.id

  if (isOwnLock) {
    // Owner can always release their lock
    await supabase.from('file_locks').delete().eq('id', lock.id)
    return NextResponse.json({ success: true })
  }

  // Check if user is admin for force-release
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Only the lock owner or an admin can release this lock' },
      { status: 403 }
    )
  }

  // Admin can release expired locks
  const heartbeatAt = new Date(lock.heartbeat_at)
  const timeoutMs = LOCK_TIMEOUT_MINUTES * 60 * 1000
  const isExpired = Date.now() - heartbeatAt.getTime() > timeoutMs

  if (!isExpired) {
    return NextResponse.json(
      { error: 'Lock is still active. Only expired locks can be force-released by admins.' },
      { status: 403 }
    )
  }

  // Use admin client to bypass RLS for deleting other user's lock
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const adminClient = createAdminClient()
  await adminClient.from('file_locks').delete().eq('id', lock.id)

  return NextResponse.json({ success: true, message: 'Expired lock released by admin' })
}

/**
 * GET /api/locks/[fileType]
 * Check the current lock status for a file type.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileType: string }> }
) {
  const { fileType } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Rate limit
  const rateLimitKey = `locks-get:${user.id}`
  const rateCheck = checkRateLimit(rateLimitKey, GET_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before retrying.' },
      { status: 429 }
    )
  }
  incrementRateLimit(rateLimitKey, GET_RATE_LIMIT)

  if (!VALID_FILE_TYPES.includes(fileType)) {
    return NextResponse.json(
      { error: 'Invalid file type' },
      { status: 400 }
    )
  }

  const { data: lock } = await supabase
    .from('file_locks')
    .select('id, file_type, locked_by, locked_at, heartbeat_at')
    .eq('file_type', fileType)
    .single()

  if (!lock) {
    return NextResponse.json({ locked: false })
  }

  // Check expiry
  const heartbeatAt = new Date(lock.heartbeat_at)
  const timeoutMs = LOCK_TIMEOUT_MINUTES * 60 * 1000
  const isExpired = Date.now() - heartbeatAt.getTime() > timeoutMs
  const isOwnLock = lock.locked_by === user.id

  // Fetch lock holder name
  const { data: lockHolder } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('user_id', lock.locked_by)
    .single()

  return NextResponse.json({
    locked: true,
    is_own_lock: isOwnLock,
    is_expired: isExpired,
    locked_by_name: lockHolder?.full_name || 'Unknown user',
    locked_at: lock.locked_at,
    heartbeat_at: lock.heartbeat_at,
  })
}

/**
 * DELETE /api/locks/[fileType]
 * Release a lock. Lock owner can always release; admins can release expired locks.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileType: string }> }
) {
  // CSRF protection: reject cross-origin requests
  if (!checkOrigin(request)) {
    return NextResponse.json(
      { error: 'Forbidden', code: 'CSRF_REJECTED' },
      { status: 403 }
    )
  }

  const { fileType } = await params

  // Rate limit (need auth first for user-scoped key)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const rateLimitKey = `locks-delete:${user.id}`
    const rateCheck = checkRateLimit(rateLimitKey, DELETE_RATE_LIMIT)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before retrying.' },
        { status: 429 }
      )
    }
    incrementRateLimit(rateLimitKey, DELETE_RATE_LIMIT)
  }

  return releaseLock(fileType)
}

/**
 * POST /api/locks/[fileType]
 * Handles lock release via navigator.sendBeacon (which can only send POST).
 * Expects body: { _method: "DELETE" }
 * This is a workaround because sendBeacon does not support DELETE requests.
 *
 * NOTE: sendBeacon may not reliably send an Origin header, so CSRF origin
 * checking is skipped for this handler. Instead, we verify the _method field
 * in the body AND the auth cookie (sendBeacon always sends cookies).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileType: string }> }
) {
  // Parse body to confirm DELETE intent
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body?._method !== 'DELETE') {
    return NextResponse.json(
      { error: 'Only _method: "DELETE" is supported via POST on this endpoint' },
      { status: 400 }
    )
  }

  const { fileType } = await params

  // Rate limit (need auth first for user-scoped key)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const rateLimitKey = `locks-beacon:${user.id}`
    const rateCheck = checkRateLimit(rateLimitKey, BEACON_RATE_LIMIT)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before retrying.' },
        { status: 429 }
      )
    }
    incrementRateLimit(rateLimitKey, BEACON_RATE_LIMIT)
  }

  // Delegate to the shared release logic (which re-checks auth, validates fileType, etc.)
  return releaseLock(fileType)
}
