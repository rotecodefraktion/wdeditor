import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NewPasswordForm } from '@/components/auth/new-password-form'
import { getTranslations } from 'next-intl/server'

export default async function ResetPasswordPage() {
  const t = await getTranslations('auth')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('setNewPasswordTitle')}</CardTitle>
        <CardDescription>
          {t('setNewPasswordDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NewPasswordForm />
      </CardContent>
    </Card>
  )
}
