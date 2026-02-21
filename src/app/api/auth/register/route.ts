import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'

const RegisterSchema = z.object({
  email: z.string().email('Ungueltige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
  github_username: z.string().min(1, 'GitHub-Benutzername ist erforderlich').max(39),
  full_name: z.string().optional(),
})

// BUG-4: Rate limiting config - max 5 registrations per IP per hour
const RATE_LIMIT_CONFIG = {
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
}

export async function POST(request: Request) {
  // BUG-4: Rate limiting by IP address
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const rateLimitKey = `register:${ip}`

  const { allowed, resetAt } = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG)
  if (!allowed) {
    const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Zu viele Registrierungsversuche. Bitte versuche es spaeter erneut.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(resetAt).toISOString(),
        },
      }
    )
  }

  // Increment counter for every registration attempt (success or failure)
  incrementRateLimit(rateLimitKey, RATE_LIMIT_CONFIG)
  const { remaining } = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungueltige Anfrage' }, { status: 400 })
  }

  const result = RegisterSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    )
  }

  const { email, password, github_username, full_name } = result.data
  const supabase = await createClient()

  // GitHub-Username bereits vergeben?
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('github_username', github_username)
    .maybeSingle()

  if (existingProfile) {
    return NextResponse.json(
      { error: 'GitHub-Account bereits mit einem Account verknuepft' },
      {
        status: 409,
        headers: {
          'X-RateLimit-Remaining': String(remaining),
        },
      }
    )
  }

  // Registrierung via Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        github_username,
        full_name: full_name ?? '',
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return NextResponse.json(
        { error: 'E-Mail bereits registriert' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(
    { message: 'Bestaetigungs-E-Mail wurde versendet', userId: data.user?.id },
    {
      status: 201,
      headers: {
        'X-RateLimit-Remaining': String(remaining),
      },
    }
  )
}
