'use client'

import { useState } from 'react'
import { Loader2, GitCommit, FilePlus, AlertTriangle } from 'lucide-react'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'
import { DiffViewer } from '@/components/github/diff-viewer'
import { ConflictWarning } from '@/components/github/conflict-warning'
import type {
  FileType,
  GitHubCommitResponse,
  GitHubConflictInfo,
} from '@/lib/github-schema'

interface CommitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  originalContent: string
  modifiedContent: string
  currentSha: string
  fileType: FileType
  fileName?: string
  onCommitSuccess: (result: GitHubCommitResponse) => void
}

export function CommitModal({
  open,
  onOpenChange,
  originalContent,
  modifiedContent,
  currentSha,
  fileType,
  fileName,
  onCommitSuccess,
}: CommitModalProps) {
  const [commitMessage, setCommitMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [conflict, setConflict] = useState<GitHubConflictInfo | null>(null)
  const [fileDeleted, setFileDeleted] = useState(false)

  async function handleCommit(force = false, createNew = false) {
    if (!commitMessage.trim()) {
      toast.error('Please enter a commit message.')
      return
    }

    setIsCommitting(true)
    try {
      const res = await fetch('/api/github/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: modifiedContent,
          commit_message: commitMessage.trim(),
          file_type: fileType,
          // Empty SHA = create new file; conflict SHA = force override; normal SHA = update
          current_sha: createNew
            ? ''
            : force && conflict
              ? conflict.current_sha
              : currentSha,
          force,
        }),
      })

      const data = await res.json()

      if (res.status === 409 && data.conflict) {
        setConflict(data as GitHubConflictInfo)
        setIsCommitting(false)
        return
      }

      if (res.status === 409 && data.code === 'FILE_DELETED') {
        setFileDeleted(true)
        setIsCommitting(false)
        return
      }

      if (!res.ok) {
        // BUG-11: Retry option for timeouts and network errors
        if (data.code === 'TIMEOUT' || data.code === 'NETWORK_ERROR') {
          toast.error(data.error || 'Request failed.', {
            action: {
              label: 'Erneut versuchen',
              onClick: () => handleCommit(force, createNew),
            },
          })
        } else {
          toast.error(data.error || 'Commit failed.')
        }
        setIsCommitting(false)
        return
      }

      // Success
      const result = data as GitHubCommitResponse
      toast.success(
        createNew ? 'Datei neu angelegt und committed.' : 'Commit erfolgreich erstellt.',
        { description: `SHA: ${result.commit_sha.slice(0, 8)}` }
      )
      setCommitMessage('')
      setConflict(null)
      setFileDeleted(false)
      onOpenChange(false)
      onCommitSuccess(result)
    } catch {
      toast.error('Netzwerkfehler.', {
        action: {
          label: 'Erneut versuchen',
          onClick: () => handleCommit(force, createNew),
        },
      })
    } finally {
      setIsCommitting(false)
    }
  }

  function handleClose() {
    if (isCommitting) return
    setConflict(null)
    setFileDeleted(false)
    setCommitMessage('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Änderungen committen
          </DialogTitle>
          <DialogDescription>
            Überprüfe deine Änderungen und erstelle einen Commit in den Dev-Branch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Diff View */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Änderungen
            </Label>
            <DiffViewer
              original={originalContent}
              modified={modifiedContent}
              fileName={fileName}
            />
          </div>

          {/* File Deleted Warning (BUG-6) */}
          {fileDeleted && (
            <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Datei gelöscht</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  Die Datei wurde auf GitHub gelöscht. Möchtest du sie neu anlegen?
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => handleCommit(false, true)}
                    disabled={isCommitting}
                  >
                    {isCommitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FilePlus className="mr-2 h-4 w-4" />
                    )}
                    Datei neu anlegen
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFileDeleted(false)}
                    disabled={isCommitting}
                  >
                    Abbrechen
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Conflict Warning */}
          {conflict && !fileDeleted && (
            <ConflictWarning
              conflict={conflict}
              onOverride={() => handleCommit(true)}
              onCancel={() => setConflict(null)}
              isOverriding={isCommitting}
            />
          )}

          {/* Commit Message */}
          {!conflict && !fileDeleted && (
            <div>
              <Label htmlFor="commit-message" className="text-sm font-medium mb-2 block">
                Commit Message
              </Label>
              <Textarea
                id="commit-message"
                placeholder="z.B. feat: Update icm/server_port configuration"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={3}
                maxLength={500}
                disabled={isCommitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {commitMessage.length}/500 — Dein Name und E-Mail werden automatisch hinzugefügt.
              </p>
            </div>
          )}
        </div>

        {!conflict && !fileDeleted && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isCommitting}
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => handleCommit(false)}
              disabled={isCommitting || !commitMessage.trim()}
            >
              {isCommitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Committen
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
