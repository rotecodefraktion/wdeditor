'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, CheckCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type FormValues = { email: string }

export function ForgotPasswordForm() {
  const t = useTranslations('auth')
  const tv = useTranslations('validation')
  const [submitted, setSubmitted] = useState(false)
  const [githubOnlyError, setGithubOnlyError] = useState(false)

  const schema = z.object({
    email: z.string().email(tv('emailRequired')),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: FormValues) {
    setGithubOnlyError(false)

    try {
      const checkResponse = await fetch('/api/auth/check-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      })
      const checkData = await checkResponse.json()

      if (checkData.githubOnly) {
        setGithubOnlyError(true)
        return
      }
    } catch {
      // If the check fails, proceed with normal reset flow
    }

    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    if (error) {
      toast.error(error.message)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          {t('resetLinkSent')}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {githubOnlyError && (
        <Alert variant="destructive">
          <AlertDescription>
            {t('githubOnlyError')}
          </AlertDescription>
        </Alert>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('emailAddress')}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder={t('emailPlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t('sendResetLink')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
