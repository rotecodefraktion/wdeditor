import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { checkOrigin } from '@/lib/csrf'

const VALID_FILE_TYPES = ['instance_profile', 'rules']

/** Rate limit: 15 heartbeats per minute per user (heartbeat every 5 min, so 15/min is generous) */
const HEARTBEAT_RATE_LIMIT = { maxRequests: 15, windowMs: 60_000 }

/**
 * PATCH /api/locks/[fileType]/heartbeat
 * Extend the lock by updating the heartbeat timestamp.
 * Only the lock owner can send heartbeats.
 */
export async function PATCH(
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
  const rateLimitKey = `locks-heartbeat:${user.id}`
  const rateCheck = checkRateLimit(rateLimitKey, HEARTBEAT_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before retrying.' },
      { status: 429 }
    )
  }
  incrementRateLimit(rateLimitKey, HEARTBEAT_RATE_LIMIT)

  if (!VALID_FILE_TYPES.includes(fileType)) {
    return NextResponse.json(
      { error: 'Invalid file type' },
      { status: 400 }
    )
  }

  // Update heartbeat only if the current user owns the lock
  const now = new Date().toISOString()
  const { data: updated, error } = await supabase
    .from('file_locks')
    .update({ heartbeat_at: now })
    .eq('file_type', fileType)
    .eq('locked_by', user.id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json(
      { error: 'Lock not found or you are not the lock owner' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    heartbeat_at: now,
  })
}
