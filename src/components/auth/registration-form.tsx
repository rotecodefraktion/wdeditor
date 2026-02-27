'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
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
import { toast } from 'sonner'

type FormValues = {
  email: string
  githubUsername: string
  password: string
  confirmPassword: string
}

interface RegistrationFormProps {
  defaultGithubUsername?: string
}

export function RegistrationForm({ defaultGithubUsername = '' }: RegistrationFormProps) {
  const t = useTranslations('auth')
  const tv = useTranslations('validation')

  const schema = z
    .object({
      email: z.string().email(tv('emailRequired')),
      githubUsername: z
        .string()
        .min(1, tv('githubUsernameRequired'))
        .regex(/^[a-zA-Z0-9-]+$/, tv('githubUsernameInvalid')),
      password: z.string().min(8, tv('passwordMinLength')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: tv('passwordsDoNotMatch'),
      path: ['confirmPassword'],
    })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      githubUsername: defaultGithubUsername,
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          github_username: values.githubUsername,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const msg = data.error ?? t('registrationFailed')
        if (msg.includes('GitHub')) {
          form.setError('githubUsername', { message: msg })
        } else if (msg.includes('E-Mail') || msg.includes('email')) {
          form.setError('email', { message: msg })
        } else {
          toast.error(msg)
        }
        return
      }

      window.location.href = '/register/confirm-email'
    } catch {
      toast.error(t('unexpectedError'))
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input type="email" placeholder={t('emailPlaceholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="githubUsername"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('githubUsername')}</FormLabel>
              <FormControl>
                <Input placeholder="octocat" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <Input type="password" placeholder={t('passwordPlaceholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('confirmPassword')}</FormLabel>
              <FormControl>
                <Input type="password" placeholder={t('passwordPlaceholder')} {...field} />
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
          {t('createAccount')}
        </Button>
      </form>
    </Form>
  )
}
