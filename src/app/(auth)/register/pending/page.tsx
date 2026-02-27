import { Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export default async function PendingApprovalPage() {
  const t = await getTranslations('auth')

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <div className="rounded-full bg-muted p-3">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <CardTitle>{t('pendingApproval')}</CardTitle>
        <CardDescription>
          {t('pendingApprovalDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          {t('noResponseHint')}
        </p>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/login">{t('backToSignIn')}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
