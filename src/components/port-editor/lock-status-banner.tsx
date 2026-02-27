'use client'

import { Lock, LockOpen, Timer, ShieldAlert, AlertTriangle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useState } from 'react'

interface LockStatusBannerProps {
  /** Whether the current user has acquired the lock */
  isLocked: boolean
  /** Whether the lock is held by someone else */
  isLockedByOther: boolean
  /** Name of the lock holder (if locked by other) */
  lockedByName?: string
  /** When the lock was acquired */
  lockedAt?: string
  /** Whether the lock is expired (admin can release) */
  isExpired?: boolean
  /** Whether the current user is an admin */
  isAdmin?: boolean
  /** Callback to force-release an expired lock */
  onForceRelease?: () => Promise<void>
  /** Error message when lock acquisition failed */
  lockError?: string
  /** Callback to retry loading and lock acquisition */
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
  const [isReleasing, setIsReleasing] = useState(false)

  // Lock acquisition failed — show error banner with retry
  if (lockError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Lock konnte nicht erworben werden</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            {lockError}
          </p>
          <p className="text-xs">
            Die Datei wird im Nur-Lesen-Modus angezeigt. Aenderungen koennen nicht gespeichert werden.
          </p>
          {onRetryLock && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetryLock}
              className="mt-1"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Erneut versuchen
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
      toast.success('Lock wurde freigegeben.')
    } catch {
      toast.error('Lock konnte nicht freigegeben werden.')
    } finally {
      setIsReleasing(false)
    }
  }

  // Current user holds the lock
  if (isLocked && !isLockedByOther) {
    return (
      <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/30">
        <Lock className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-800 dark:text-green-200">
          Datei gesperrt
        </AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-300 flex items-center gap-2">
          <span>Du hast diese Datei zur Bearbeitung gesperrt.</span>
          <Timer className="h-3.5 w-3.5" />
          <span className="text-xs">Heartbeat aktiv</span>
        </AlertDescription>
      </Alert>
    )
  }

  // Locked by another user
  if (isLockedByOther) {
    const lockedAtFormatted = lockedAt
      ? new Date(lockedAt).toLocaleString('de-DE')
      : 'Unbekannt'

    return (
      <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/30">
        <ShieldAlert className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200">
          Nur-Lesen-Modus
        </AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300">
          <p>
            Gesperrt von <strong>{lockedByName || 'Unbekannt'}</strong> seit{' '}
            {lockedAtFormatted}.
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
                {isReleasing ? 'Wird freigegeben...' : 'Abgelaufenen Lock freigeben'}
              </Button>
            </div>
          )}
          {isExpired && !isAdmin && (
            <p className="mt-1 text-xs">
              Der Lock ist abgelaufen. Ein Admin kann ihn freigeben.
            </p>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
