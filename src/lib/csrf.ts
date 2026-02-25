import type { NextRequest } from 'next/server'

/**
 * Check that the request Origin (or Referer) header matches the configured app URL.
 * Returns true if the origin is valid (same-origin or missing), false if cross-origin.
 *
 * If NEXT_PUBLIC_APP_URL is not set, origin checking is skipped (returns true).
 * If no Origin header is present, the Referer header is checked as a fallback.
 */
export function checkOrigin(request: NextRequest): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    // Cannot validate without a configured app URL; allow the request
    return true
  }

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Determine the request origin from Origin header or Referer header
  const requestOrigin = origin || (referer ? new URL(referer).origin : null)

  if (!requestOrigin) {
    // No origin information available; allow (same-site requests may omit Origin)
    return true
  }

  try {
    return new URL(requestOrigin).origin === new URL(appUrl).origin
  } catch {
    // Malformed URL in Origin/Referer header
    return false
  }
}
