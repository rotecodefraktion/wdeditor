import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
})

/**
 * Checks whether an email belongs to a GitHub-OAuth-only user (no password provider).
 * Uses the Supabase service role key to inspect auth.users identities.
 * For security, returns { githubOnly: false } when the email does not exist
 * (does not reveal whether the account exists).
 *
 * NOTE: The Supabase admin API does not provide a getUserByEmail method.
 * We use listUsers() which scans all users. For small user bases (2-10 users
 * as per PRD), this is acceptable. If user count grows significantly,
 * consider using a direct SQL query via Supabase RPC or adding an email
 * index/lookup table.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ githubOnly: false })
    }

    let adminSupabase
    try {
      adminSupabase = createAdminClient()
    } catch {
      // Without service role, we cannot check provider info
      return NextResponse.json({ githubOnly: false })
    }

    const { data: userList } = await adminSupabase.auth.admin.listUsers()
    const user = userList?.users?.find(
      (u) => u.email?.toLowerCase() === parsed.data.email.toLowerCase()
    )

    if (!user) {
      return NextResponse.json({ githubOnly: false })
    }

    const providers: string[] = user.app_metadata?.providers ?? []
    const hasEmailProvider = providers.includes('email')
    const hasGithubProvider = providers.includes('github')

    if (hasGithubProvider && !hasEmailProvider) {
      return NextResponse.json({ githubOnly: true })
    }

    return NextResponse.json({ githubOnly: false })
  } catch {
    return NextResponse.json({ githubOnly: false })
  }
}
