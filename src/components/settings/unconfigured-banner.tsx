'use client'

import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Settings } from 'lucide-react'

interface UnconfiguredBannerProps {
  userRole?: string
}

/**
 * Shown on dashboard to non-admin users when the app is not yet configured.
 * Fetches a lightweight check endpoint to determine configuration status.
 * Per AC-9: Only shown to non-admin users. Admins see the Settings nav link instead.
 */
export function UnconfiguredBanner({ userRole }: UnconfiguredBannerProps) {
  const [show, setShow] = useState(false)

  // Admins and super_admins should never see this banner (AC-9)
  const isAdmin = userRole === 'admin' || userRole === 'super_admin'

  useEffect(() => {
    // Skip the fetch entirely for admin users
    if (isAdmin) return

    async function checkConfig() {
      try {
        const res = await fetch('/api/settings/status')
        if (res.ok) {
          const data = await res.json()
          setShow(!data.configured)
        }
      } catch {
        // Silently fail -- banner just won't show
      }
    }
    checkConfig()
  }, [isAdmin])

  if (isAdmin || !show) return null

  return (
    <Alert className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/30">
      <Settings className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <AlertTitle className="text-blue-800 dark:text-blue-200">
        Die App ist noch nicht konfiguriert
      </AlertTitle>
      <AlertDescription className="text-blue-700 dark:text-blue-300">
        Die Anwendung wurde noch nicht eingerichtet. Bitte wenden Sie sich an
        einen Administrator, um die GitHub-Repository-Verbindung in den
        Einstellungen zu konfigurieren.
      </AlertDescription>
    </Alert>
  )
}
