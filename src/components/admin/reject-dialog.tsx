'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { UserProfile } from '@/components/admin/user-table'

interface RejectDialogProps {
  user: UserProfile | null
  onClose: () => void
  onConfirm: (reason?: string) => Promise<void>
}

export function RejectDialog({ user, onClose, onConfirm }: RejectDialogProps) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  function handleOpenChange(open: boolean) {
    if (!open) {
      setReason('')
      onClose()
    }
  }

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm(reason.trim() || undefined)
      setReason('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject User</DialogTitle>
          <DialogDescription>
            Reject the registration request from{' '}
            <span className="font-medium">{user?.full_name || user?.github_username || 'this user'}</span>.
            You can optionally provide a reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-reason">Reason (optional)</Label>
          <Textarea
            id="reject-reason"
            placeholder="Enter a reason for rejection..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
          />
          <p className="text-xs text-muted-foreground text-right">
            {reason.length}/500
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Rejecting...' : 'Reject User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
