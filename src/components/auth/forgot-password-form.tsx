'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, CheckCircle } from 'lucide-react'
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

const schema = z.object({
  email: z.string().email('Please enter a valid email address.'),
})

type FormValues = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false)
  const [githubOnlyError, setGithubOnlyError] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: FormValues) {
    setGithubOnlyError(false)

    // Check if the user signed up with GitHub OAuth only (no password)
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
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      toast.error(error.message)
      return
    }

    // Always show the same message for security (don't reveal if email exists)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          If this email is registered, a password reset link has been sent. Please
          check your inbox.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {githubOnlyError && (
        <Alert variant="destructive">
          <AlertDescription>
            You signed up with GitHub. Please use the GitHub login button instead.
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
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="admin@example.com" {...field} />
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
            Send Reset Link
          </Button>
        </form>
      </Form>
    </div>
  )
}
