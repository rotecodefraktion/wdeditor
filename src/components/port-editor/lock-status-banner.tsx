'use client'

import { Lock, LockOpen, Timer, ShieldAlert, AlertTriangle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface LockStatusBannerProps {
  isLocked: boolean
  isLockedByOther: boolean
  lockedByName?: string
  lockedAt?: string
  isExpired?: boolean
  isAdmin?: boolean
  onForceRelease?: () => Promise<void>
  lockError?: string
  onRetryLock?: () => void
}

export function LockStatusBanner({
  isLocked,
  isLockedByOther,
  lockedByName,
  lockedAt,
  isExpired,
  isAdmin,
  onForceRelease,
  lockError,
  onRetryLock,
}: LockStatusBannerProps) {
  const t = useTranslations('lockBanner')
  const tc = useTranslations('common')
  const [isReleasing, setIsReleasing] = useState(false)

  if (lockError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t('lockFailedTitle')}</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{lockError}</p>
          <p className="text-xs">{t('lockFailedReadonly')}</p>
          {onRetryLock && (
            <Button variant="outline" size="sm" onClick={onRetryLock} className="mt-1">
              <RefreshCw className="h-4 w-4 mr-1" />
              {t('retry')}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  if (!isLocked && !isLockedByOther) return null

  async function handleForceRelease() {
    if (!onForceRelease) return
    setIsReleasing(true)
    try {
      await onForceRelease()
      toast.success(t('lockReleased'))
    } catch {
      toast.error(t('lockReleaseFailed'))
    } finally {
      setIsReleasing(false)
    }
  }

  if (isLocked && !isLockedByOther) {
    return (
      <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/30">
        <Lock className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-800 dark:text-green-200">
          {t('fileLocked')}
        </AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-300 flex items-center gap-2">
          <span>{t('fileLockedByYou')}</span>
          <Timer className="h-3.5 w-3.5" />
          <span className="text-xs">{t('heartbeatActive')}</span>
        </AlertDescription>
      </Alert>
    )
  }

  if (isLockedByOther) {
    const lockedAtFormatted = lockedAt
      ? new Date(lockedAt).toLocaleString('de-DE')
      : tc('unknown')

    return (
      <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/30">
        <ShieldAlert className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200">
          {t('readOnlyMode')}
        </AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300">
          <p>
            {t('lockedBy', {
              name: lockedByName || tc('unknown'),
              date: lockedAtFormatted,
            })}
          </p>
          {isExpired && isAdmin && (
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleForceRelease}
                disabled={isReleasing}
                className="border-yellow-500 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-400 dark:text-yellow-200 dark:hover:bg-yellow-900"
              >
                <LockOpen className="h-4 w-4 mr-1" />
                {isReleasing ? t('releasing') : t('releaseExpiredLock')}
              </Button>
            </div>
          )}
          {isExpired && !isAdmin && (
            <p className="mt-1 text-xs">
              {t('lockExpiredAdmin')}
            </p>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
