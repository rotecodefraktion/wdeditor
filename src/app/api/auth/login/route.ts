import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const LOGIN_RATE_LIMIT = {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP - only count failed attempts
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const rateLimitKey = `login:${ip}`
    const rateLimit = checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Zu viele Anmeldeversuche. Bitte versuche es spaeter erneut.', code: 'rate_limited' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          },
        }
      )
    }

    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', code: 'validation_error' },
        { status: 400 }
      )
    }

    const { email, password } = parsed.data

    const supabase = await createClient()

    // Step 1: Attempt sign-in first to get user object
    // signInWithPassword returns the user including user.id on success
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.session) {
      // Increment rate limit only on failed login (wrong credentials)
      incrementRateLimit(rateLimitKey, LOGIN_RATE_LIMIT)
      return NextResponse.json(
        { error: 'Invalid email or password.', code: 'invalid_credentials' },
        { status: 401 }
      )
    }

    // Step 2: Check user_profiles status using the authenticated user's ID
    // No need for admin listUsers - we already have the user from signInWithPassword
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('status')
      .eq('user_id', authData.user.id)
      .single()

    if (profile?.status !== 'active') {
      // Sign out the non-active user immediately
      await supabase.auth.signOut()
      // Increment rate limit on non-active status rejection
      incrementRateLimit(rateLimitKey, LOGIN_RATE_LIMIT)
      return NextResponse.json(
        { error: 'Account not active.', code: profile?.status ?? 'unknown_status' },
        { status: 403 }
      )
    }

    // User is active, session is already set via cookies by Supabase
    // Do NOT increment rate limit on successful login
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error.', code: 'server_error' },
      { status: 500 }
    )
  }
}
