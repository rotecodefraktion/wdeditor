import { Mail } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ResendEmailButton } from '@/components/auth/resend-email-button'
import { createClient } from '@/lib/supabase/server'

export default async function ConfirmEmailPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <div className="rounded-full bg-muted p-3">
            <Mail className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <CardTitle>Check Your Email</CardTitle>
        <CardDescription>
          We&apos;ve sent a confirmation link to{' '}
          <span className="font-medium text-foreground">
            {user?.email ?? 'your email address'}
          </span>
          . Please click the link to verify your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          The confirmation link expires after 24 hours. If it expires, use the
          button below to request a new one.
        </p>
        <p className="text-sm text-muted-foreground text-center">
          Didn&apos;t receive the email? Check your spam folder or request a new
          confirmation link.
        </p>
        <ResendEmailButton email={user?.email} />
      </CardContent>
    </Card>
  )
}
