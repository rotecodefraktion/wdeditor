import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { RegistrationForm } from '@/components/auth/registration-form'
import { GitHubOAuthButton } from '@/components/auth/github-oauth-button'

interface RegisterPageProps {
  searchParams: Promise<{ github?: string }>
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams
  const defaultGithubUsername = params.github ?? ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Register to request access to the Web Dispatcher Editor. An administrator
          must approve your account before you can sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RegistrationForm defaultGithubUsername={defaultGithubUsername} />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>
        <GitHubOAuthButton label="Register with GitHub" />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="underline hover:text-foreground">
            Sign In
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
