import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createAdminClient } from '@/lib/supabase/admin'
import { locales, defaultLocale, type Locale } from '@/i18n/config'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/auth',
  '/reset-password',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── NEXT_LOCALE cookie handling ─────────────────────────────
  const localeCookie = request.cookies.get('NEXT_LOCALE')?.value as Locale | undefined
  let needsSetLocale = false
  let resolvedLocale: Locale = defaultLocale

  if (localeCookie && locales.includes(localeCookie)) {
    resolvedLocale = localeCookie
  } else {
    needsSetLocale = true
  }

  // ─── Auth / session handling ──────────────────────────────────

  // Öffentliche Routen immer durchlassen
  if (isPublicPath(pathname)) {
    const { supabaseResponse } = await updateSession(request)
    if (needsSetLocale) {
      supabaseResponse.cookies.set('NEXT_LOCALE', resolvedLocale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: 'lax',
      })
    }
    return supabaseResponse
  }

  const { supabase, supabaseResponse, user } = await updateSession(request)

  // Set NEXT_LOCALE cookie if needed
  if (needsSetLocale) {
    supabaseResponse.cookies.set('NEXT_LOCALE', resolvedLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  // Keine Session → Login
  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // User-Status aus user_profiles prüfen
  // Use admin client to bypass RLS (recursive policy on user_profiles causes infinite loop)
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('user_profiles')
    .select('status')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  const status = profile.status

  if (status === 'unconfirmed') {
    const url = request.nextUrl.clone()
    url.pathname = '/register/confirm-email'
    return NextResponse.redirect(url)
  }

  if (status === 'pending_approval') {
    const url = request.nextUrl.clone()
    url.pathname = '/register/pending'
    return NextResponse.redirect(url)
  }

  if (status === 'rejected') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'rejected')
    return NextResponse.redirect(url)
  }

  if (status === 'deactivated') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'deactivated')
    return NextResponse.redirect(url)
  }

  // status === 'active' → Zugang erlaubt
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Alle Routen außer statischen Assets, Next.js Internals und API-Routen
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
