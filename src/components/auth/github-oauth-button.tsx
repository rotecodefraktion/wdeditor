'use client'

import { useState } from 'react'
import { Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function GitHubOAuthButton({ label = 'Continue with GitHub' }: { label?: string }) {
  const [loading, setLoading] = useState(false)

  async function handleGitHubLogin() {
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
    }
    // On success the browser is redirected – no need to setLoading(false)
  }

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleGitHubLogin}
      disabled={loading}
    >
      <Github className="mr-2 h-4 w-4" />
      {loading ? 'Redirecting…' : label}
    </Button>
  )
}
