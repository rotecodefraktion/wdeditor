'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { UserProfile } from '@/components/admin/user-table'

interface DeactivateDialogProps {
  user: UserProfile | null
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function DeactivateDialog({ user, onClose, onConfirm }: DeactivateDialogProps) {
  const t = useTranslations('admin')
  const tc = useTranslations('common')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deactivateTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deactivateDescription', { name: user?.full_name || user?.github_username || 'this user' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{tc('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? t('deactivating') : t('deactivate')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
