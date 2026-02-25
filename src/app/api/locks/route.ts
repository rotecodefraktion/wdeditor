import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { checkOrigin } from '@/lib/csrf'
import { z } from 'zod'

const acquireLockSchema = z.object({
  file_type: z.enum(['instance_profile', 'rules']),
})

/** Lock timeout in minutes */
const LOCK_TIMEOUT_MINUTES = 30

/** Rate limit: 20 lock operations per minute per user */
const LOCK_RATE_LIMIT = { maxRequests: 20, windowMs: 60_000 }

/**
 * POST /api/locks
 * Acquire a lock for a file type.
 * Returns the lock if acquired, or info about the current lock holder.
 */
export async function POST(request: NextRequest) {
  // CSRF protection: reject cross-origin requests
  if (!checkOrigin(request)) {
    return NextResponse.json(
      { error: 'Forbidden', code: 'CSRF_REJECTED' },
      { status: 403 }
    )
  }

  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Rate limit per user
  const rateLimitKey = `locks-post:${user.id}`
  const rateCheck = checkRateLimit(rateLimitKey, LOCK_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before retrying.' },
      { status: 429 }
    )
  }
  incrementRateLimit(rateLimitKey, LOCK_RATE_LIMIT)

  // Check user is active
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('status')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.status !== 'active') {
    return NextResponse.json(
      { error: 'Account is not active' },
      { status: 403 }
    )
  }

  // Parse body
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parseResult = acquireLockSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid file_type', details: parseResult.error.flatten() },
      { status: 400 }
    )
  }

  const { file_type } = parseResult.data

  // Check if lock already exists
  const { data: existingLock } = await supabase
    .from('file_locks')
    .select('id, file_type, locked_by, locked_at, heartbeat_at')
    .eq('file_type', file_type)
    .single()

  if (existingLock) {
    // Check if the lock is expired (heartbeat older than timeout)
    const heartbeatAt = new Date(existingLock.heartbeat_at)
    const timeoutMs = LOCK_TIMEOUT_MINUTES * 60 * 1000
    const isExpired = Date.now() - heartbeatAt.getTime() > timeoutMs

    if (existingLock.locked_by === user.id) {
      // User already holds the lock - refresh heartbeat
      await supabase
        .from('file_locks')
        .update({ heartbeat_at: new Date().toISOString() })
        .eq('id', existingLock.id)

      return NextResponse.json({
        acquired: true,
        lock: { ...existingLock, heartbeat_at: new Date().toISOString() },
      })
    }

    if (!isExpired) {
      // Lock held by someone else and not expired
      // Fetch the lock holder's name
      const { data: lockHolder } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('user_id', existingLock.locked_by)
        .single()

      return NextResponse.json({
        acquired: false,
        locked_by_name: lockHolder?.full_name || 'Unknown user',
        locked_at: existingLock.locked_at,
        heartbeat_at: existingLock.heartbeat_at,
        is_expired: false,
      })
    }

    // BUG-10 FIX: Lock is expired - attempt takeover atomically.
    // Use admin client to delete the expired lock (bypasses RLS owner check),
    // then immediately attempt the insert. If another user concurrently deleted
    // the same expired lock, the delete is a no-op (0 rows affected), which is
    // fine -- we proceed to the insert attempt regardless. The unique constraint
    // on file_type is the safety net: if two users race to takeover, exactly one
    // insert will succeed and the other will get a 23505 violation handled below.
    const adminClient = createAdminClient()
    try {
      await adminClient
        .from('file_locks')
        .delete()
        .eq('id', existingLock.id)
    } catch {
      // If the delete fails (lock already deleted by another concurrent request),
      // we gracefully continue to the insert attempt below.
    }
  }

  // Try to acquire the lock
  const now = new Date().toISOString()
  const { data: newLock, error: insertError } = await supabase
    .from('file_locks')
    .insert({
      file_type,
      locked_by: user.id,
      locked_at: now,
      heartbeat_at: now,
    })
    .select()
    .single()

  if (insertError) {
    // Unique constraint violation (23505) = race condition, someone else got it first.
    // This is the safety net for the TOCTOU race in expired lock takeover:
    // two users may both detect expiry and attempt takeover, but only one insert
    // can succeed due to the unique constraint on file_type.
    if (insertError.code === '23505') {
      // Re-fetch to get the winner's info
      const { data: raceLock } = await supabase
        .from('file_locks')
        .select('locked_by, locked_at, heartbeat_at')
        .eq('file_type', file_type)
        .single()

      const { data: lockHolder } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('user_id', raceLock?.locked_by || '')
        .single()

      return NextResponse.json({
        acquired: false,
        locked_by_name: lockHolder?.full_name || 'Unknown user',
        locked_at: raceLock?.locked_at,
        heartbeat_at: raceLock?.heartbeat_at,
        is_expired: false,
      })
    }

    return NextResponse.json(
      { error: `Failed to acquire lock: ${insertError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    acquired: true,
    lock: newLock,
  })
}
