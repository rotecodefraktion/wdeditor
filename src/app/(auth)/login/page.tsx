import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, Info } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'
import { GitHubOAuthButton } from '@/components/auth/github-oauth-button'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; message?: string }>
}

async function getUserCount(): Promise<number> {
  try {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    if (error) return -1
    return count ?? 0
  } catch {
    return -1
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t = await getTranslations('auth')
  const params = await searchParams
  const errorStatus = params.error ?? null
  const message = params.message ?? null
  const userCount = await getUserCount()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('signInTitle')}</CardTitle>
        <CardDescription>
          {t('signInDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {userCount === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t.rich('noAdminYet', {
                registerLink: (chunks) => (
                  <Link href="/register" className="font-medium underline hover:text-foreground">
                    {chunks}
                  </Link>
                ),
              })}
            </AlertDescription>
          </Alert>
        )}
        {message === 'password_reset' && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {t('passwordResetSuccess')}
            </AlertDescription>
          </Alert>
        )}
        <LoginForm initialError={errorStatus} />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">{t('or', { ns: 'common' })}</span>
          </div>
        </div>
        <GitHubOAuthButton label={t('signInWithGitHub')} />
        <p className="text-center text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/register" className="underline hover:text-foreground">
            {t('register')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
