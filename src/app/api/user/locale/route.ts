import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const localeSchema = z.object({
  locale: z.enum(['de', 'en', 'pt']),
})

/**
 * PATCH /api/user/locale
 * Updates the authenticated user's locale preference in user_profiles.
 * Only the locale column is updated — no other profile fields.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Parse and validate body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const result = localeSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { locale } = result.data

    // Update only the locale column for the authenticated user
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ locale })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[PATCH /api/user/locale] DB error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/user/locale] Unhandled error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
