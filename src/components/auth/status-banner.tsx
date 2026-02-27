'use client'

import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTranslations } from 'next-intl'

interface StatusBannerProps {
  status: string | null
}

export function StatusBanner({ status }: StatusBannerProps) {
  const t = useTranslations('status')

  if (!status) return null

  const knownStatuses = [
    'unconfirmed',
    'pending_approval',
    'rejected',
    'deactivated',
    'invalid_credentials',
    'server_error',
    'unknown_status',
  ]

  const message = knownStatuses.includes(status) ? t(status as never) : t('default')

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
