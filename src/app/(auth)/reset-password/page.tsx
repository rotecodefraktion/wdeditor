import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NewPasswordForm } from '@/components/auth/new-password-form'

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Set New Password</CardTitle>
        <CardDescription>
          Enter a new password for your account. The password must be at least 8
          characters long.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NewPasswordForm />
      </CardContent>
    </Card>
  )
}
