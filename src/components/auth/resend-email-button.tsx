'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function ResendEmailButton({ email }: { email?: string }) {
  const t = useTranslations('auth')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleResend() {
    if (!email) {
      toast.error(t('emailNotFound'))
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
    toast.success(t('confirmationEmailSent'))
  }

  return (
    <Button
      variant="outline"
      onClick={handleResend}
      disabled={loading || sent}
      className="w-full"
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {sent ? t('emailSent') : t('resendEmail')}
    </Button>
  )
}
