import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { getTranslations } from 'next-intl/server'

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('resetPasswordTitle')}</CardTitle>
        <CardDescription>
          {t('resetPasswordDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ForgotPasswordForm />
        <Button variant="ghost" className="w-full" asChild>
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToSignIn')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
