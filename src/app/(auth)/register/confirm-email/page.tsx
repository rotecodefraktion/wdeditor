import { Mail } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ResendEmailButton } from '@/components/auth/resend-email-button'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'

export default async function ConfirmEmailPage() {
  const t = await getTranslations('auth')
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
        <CardTitle>{t('checkEmail')}</CardTitle>
        <CardDescription>
          {t('checkEmailDescription', {
            email: user?.email ?? t('yourEmailAddress'),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          {t('confirmLinkExpiry')}
        </p>
        <p className="text-sm text-muted-foreground text-center">
          {t('didntReceiveEmail')}
        </p>
        <ResendEmailButton email={user?.email} />
      </CardContent>
    </Card>
  )
}
