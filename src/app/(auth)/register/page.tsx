import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { RegistrationForm } from '@/components/auth/registration-form'
import { GitHubOAuthButton } from '@/components/auth/github-oauth-button'
import { getTranslations } from 'next-intl/server'

interface RegisterPageProps {
  searchParams: Promise<{ github?: string }>
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const t = await getTranslations('auth')
  const tc = await getTranslations('common')
  const params = await searchParams
  const defaultGithubUsername = params.github ?? ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('createAccountTitle')}</CardTitle>
        <CardDescription>
          {t('createAccountDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RegistrationForm defaultGithubUsername={defaultGithubUsername} />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">{tc('or')}</span>
          </div>
        </div>
        <GitHubOAuthButton label={t('registerWithGitHub')} />
        <p className="text-center text-sm text-muted-foreground">
          {t('alreadyHaveAccount')}{' '}
          <Link href="/login" className="underline hover:text-foreground">
            {t('signIn')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
