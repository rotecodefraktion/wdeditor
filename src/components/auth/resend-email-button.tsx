'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function ResendEmailButton({ email }: { email?: string }) {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleResend() {
    if (!email) {
      toast.error('Email address not found. Please register again.')
      return
    }
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setSent(true)
    toast.success('Confirmation email sent.')
  }

  return (
    <Button
      variant="outline"
      onClick={handleResend}
      disabled={loading || sent}
      className="w-full"
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {sent ? 'Email sent' : 'Resend confirmation email'}
    </Button>
  )
}
