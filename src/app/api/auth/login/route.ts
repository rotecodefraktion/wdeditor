import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
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

    // Collect cookies from signInWithPassword to apply to the response
    const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach((cookie) => pendingCookies.push(cookie))
          },
        },
      }
    )

    // Step 1: Attempt sign-in first to get user object
    let authData: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data']
    let authError: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['error']

    try {
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      authData = result.data
      authError = result.error
    } catch {
      // signInWithPassword can throw for network errors or unexpected responses
      // Treat any thrown error as invalid credentials to avoid leaking info
      incrementRateLimit(rateLimitKey, LOGIN_RATE_LIMIT)
      return NextResponse.json(
        { error: 'Invalid email or password.', code: 'invalid_credentials' },
        { status: 401 }
      )
    }

    if (authError || !authData.session) {
      // Increment rate limit only on failed login (wrong credentials)
      incrementRateLimit(rateLimitKey, LOGIN_RATE_LIMIT)
      return NextResponse.json(
        { error: 'Invalid email or password.', code: 'invalid_credentials' },
        { status: 401 }
      )
    }

    // Step 2: Check user_profiles status and locale using admin client
    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('status, locale')
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

    // User is active - create response and explicitly set session cookies
    const response = NextResponse.json({ success: true })
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options as Record<string, string>)
    })

    // Sync locale preference from profile to NEXT_LOCALE cookie
    const userLocale = profile?.locale ?? 'de'
    response.cookies.set('NEXT_LOCALE', userLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    })

    return response
  } catch (error) {
    console.error('[POST /api/auth/login] Unhandled error:', error)
    return NextResponse.json(
      { error: 'Internal server error.', code: 'server_error' },
      { status: 500 }
    )
  }
}
