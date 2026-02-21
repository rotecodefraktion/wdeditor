import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/auth',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Öffentliche Routen immer durchlassen
  if (isPublicPath(pathname)) {
    const { supabaseResponse } = await updateSession(request)
    return supabaseResponse
  }

  const { supabase, supabaseResponse, user } = await updateSession(request)

  // Keine Session → Login
  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // User-Status aus user_profiles prüfen
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('status')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    // Profil fehlt (sollte nicht vorkommen durch Trigger)
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
     * Alle Routen außer statischen Assets und Next.js Internals
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
