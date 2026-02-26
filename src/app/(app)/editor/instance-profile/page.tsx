'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { GitCommit, Save, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { LockStatusBanner } from '@/components/port-editor/lock-status-banner'
import { PortTable } from '@/components/port-editor/port-table'
import { PortForm } from '@/components/port-editor/port-form'
import type { PortFormMode, PortFormValues } from '@/components/port-editor/port-form'
import { DeletePortDialog } from '@/components/port-editor/delete-port-dialog'
import { ReadonlyParamsSection } from '@/components/port-editor/readonly-params-section'
import { CommitModal } from '@/components/github/commit-modal'
import {
  parseInstanceProfile,
  serializeInstanceProfile,
  getNextPortIndex,
  createEmptyPortEntry,
} from '@/lib/port-parser'
import type { PortEntry, ParseResult } from '@/lib/port-parser'
import type { GitHubFileResponse, GitHubCommitResponse } from '@/lib/github-schema'
import { createClient } from '@/lib/supabase'
import { checkPortInRules } from '@/lib/rules-integrity'

/** Heartbeat interval: 5 minutes */
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000

type PageState = 'loading' | 'error' | 'ready'

interface LockState {
  isLocked: boolean
  isLockedByOther: boolean
  lockedByName?: string
  lockedAt?: string
  isExpired?: boolean
}

export default function InstanceProfileEditorPage() {
  // Auth/role state
  const [isAdmin, setIsAdmin] = useState(false)

  // Page state
  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  // File state
  const [originalContent, setOriginalContent] = useState('')
  const [currentSha, setCurrentSha] = useState('')
  const [filePath, setFilePath] = useState('')
  const [lastCommit, setLastCommit] = useState<GitHubFileResponse['last_commit'] | null>(null)

  // Parsed data
  const [portEntries, setPortEntries] = useState<PortEntry[]>([])
  const [nonPortLines, setNonPortLines] = useState<string[]>([])
  const [lineMap, setLineMap] = useState<ParseResult['lineMap']>([])

  // Lock state
  const [lockState, setLockState] = useState<LockState>({
    isLocked: false,
    isLockedByOther: false,
  })
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)

  // UI state
  const [isDirty, setIsDirty] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<PortFormMode>('add')
  const [formEntry, setFormEntry] = useState<PortEntry | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteEntry, setDeleteEntry] = useState<PortEntry | null>(null)
  const [commitModalOpen, setCommitModalOpen] = useState(false)
  const [rulesWarning, setRulesWarning] = useState<string | null>(null)

  const readOnly = lockState.isLockedByOther || !lockState.isLocked

  // ─── Auth check ───────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      setIsAdmin(
        profile?.role === 'admin' || profile?.role === 'super_admin'
      )
    }
    checkAuth()
  }, [])

  // ─── Load file + acquire lock ─────────────────────────────────
  const loadFile = useCallback(async () => {
    setPageState('loading')
    setErrorMessage('')

    try {
      // Load file from GitHub
      const fileRes = await fetch('/api/github/file?type=instance_profile')

      if (!fileRes.ok) {
        const data = await fileRes.json()
        if (data.code === 'FILE_NOT_FOUND') {
          setErrorMessage(
            `Datei nicht gefunden: ${data.error}. Bitte pruefen Sie die Settings.`
          )
        } else {
          setErrorMessage(data.error || 'Datei konnte nicht geladen werden.')
        }
        setPageState('error')
        return
      }

      const fileData: GitHubFileResponse = await fileRes.json()

      // Parse file content
      const parsed = parseInstanceProfile(fileData.content)

      setOriginalContent(fileData.content)
      setCurrentSha(fileData.sha)
      setFilePath(fileData.file_path)
      setLastCommit(fileData.last_commit)
      setPortEntries(parsed.portEntries)
      setNonPortLines(parsed.nonPortLines)
      setLineMap(parsed.lineMap)
      setIsDirty(false)

      // Try to acquire lock
      const lockRes = await fetch('/api/locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_type: 'instance_profile' }),
      })

      if (lockRes.ok) {
        const lockData = await lockRes.json()
        if (lockData.acquired) {
          setLockState({
            isLocked: true,
            isLockedByOther: false,
          })
        } else {
          setLockState({
            isLocked: false,
            isLockedByOther: true,
            lockedByName: lockData.locked_by_name,
            lockedAt: lockData.locked_at,
            isExpired: lockData.is_expired,
          })
        }
      }

      setPageState('ready')
    } catch {
      setErrorMessage('Netzwerkfehler beim Laden der Datei.')
      setPageState('error')
    }
  }, [])

  useEffect(() => {
    loadFile()
  }, [loadFile])

  // ─── Heartbeat ────────────────────────────────────────────────
  useEffect(() => {
    if (lockState.isLocked && !lockState.isLockedByOther) {
      heartbeatRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/locks/instance_profile/heartbeat', {
            method: 'PATCH',
          })
          if (!res.ok) {
            console.warn('Heartbeat failed - lock may have been released')
          }
        } catch {
          console.warn('Heartbeat network error')
        }
      }, HEARTBEAT_INTERVAL_MS)

      return () => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      }
    }
  }, [lockState.isLocked, lockState.isLockedByOther])

  // ─── Release lock on unmount / beforeunload ───────────────────
  useEffect(() => {
    function releaseLock() {
      if (lockState.isLocked && !lockState.isLockedByOther) {
        // Use sendBeacon for reliability on page close
        navigator.sendBeacon?.(
          '/api/locks/instance_profile',
          new Blob(
            [JSON.stringify({ _method: 'DELETE' })],
            { type: 'application/json' }
          )
        )
      }
    }

    window.addEventListener('beforeunload', releaseLock)

    return () => {
      window.removeEventListener('beforeunload', releaseLock)
      // Also release on component unmount
      if (lockState.isLocked && !lockState.isLockedByOther) {
        fetch('/api/locks/instance_profile', { method: 'DELETE' }).catch(() => {})
      }
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [lockState.isLocked, lockState.isLockedByOther])

  // ─── Handlers ─────────────────────────────────────────────────

  function handleAdd() {
    setFormMode('add')
    setFormEntry(null)
    setRulesWarning(null)
    setFormOpen(true)
  }

  async function handleEdit(entry: PortEntry) {
    setFormMode('edit')
    setFormEntry(entry)
    setRulesWarning(null)
    setFormOpen(true)
  }

  function handleDuplicate(entry: PortEntry) {
    setFormMode('duplicate')
    setFormEntry(entry)
    setRulesWarning(null)
    setFormOpen(true)
  }

  function handleDeleteRequest(entry: PortEntry) {
    setDeleteEntry(entry)
    setDeleteDialogOpen(true)
  }

  function handleFormSubmit(values: PortFormValues, mode: PortFormMode) {
    const portNum = parseInt(values.port, 10)
    const timeout = values.timeout ? parseInt(values.timeout, 10) : null

    // Parse extra params
    const extraParams: Record<string, string> = {}
    if (values.extraParams?.trim()) {
      const pairs = values.extraParams.split(',').map((p) => p.trim())
      for (const pair of pairs) {
        const eqIdx = pair.indexOf('=')
        if (eqIdx > 0) {
          const key = pair.slice(0, eqIdx).trim().toUpperCase()
          const val = pair.slice(eqIdx + 1).trim()
          extraParams[key] = val
        }
      }
    }

    // Detect unknown keys
    const knownSet = new Set([
      'PROT', 'PORT', 'TIMEOUT', 'HOST', 'VCLIENT', 'SSLCONFIG',
      'EXTBIND', 'NOLISTEN', 'PROCTIMEOUT', 'KEEPALIVE',
    ])
    const unknownKeys = Object.keys(extraParams).filter((k) => !knownSet.has(k))

    if (mode === 'edit' && formEntry) {
      // Update existing entry
      setPortEntries((prev) =>
        prev.map((e) =>
          e.index === formEntry.index
            ? {
                ...e,
                prot: values.prot,
                port: portNum,
                timeout,
                host: values.host || '',
                vclient: values.prot === 'HTTPS' && values.vclient && values.vclient !== 'not_set' ? values.vclient : '',
                sslconfig: values.prot === 'HTTPS' ? values.sslconfig || '' : '',
                extraParams,
                unknownKeys,
                rawLine: null,
              }
            : e
        )
      )

      // Check if port was changed and warn about rules
      if (formEntry.port !== portNum && formEntry.port !== null) {
        checkRulesForPort(formEntry.port).then((result) => {
          if (result && result.matchCount > 0) {
            toast.warning(
              `Es existieren ${result.matchCount} Regeln in rules.txt fuer Port ${formEntry.port}. Diese werden nicht automatisch auf Port ${portNum} angepasst.`,
              { duration: 8000 }
            )
          }
        })
      }
    } else {
      // Add or duplicate: create new entry
      const newIndex = getNextPortIndex(portEntries)
      const newEntry: PortEntry = {
        ...createEmptyPortEntry(newIndex),
        prot: values.prot,
        port: portNum,
        timeout,
        host: values.host || '',
        vclient: values.prot === 'HTTPS' && values.vclient && values.vclient !== 'not_set' ? values.vclient : '',
        sslconfig: values.prot === 'HTTPS' ? values.sslconfig || '' : '',
        extraParams,
        unknownKeys,
      }
      setPortEntries((prev) => [...prev, newEntry])
    }

    setIsDirty(true)
  }

  function handleDeleteConfirm(entry: PortEntry) {
    setPortEntries((prev) => prev.filter((e) => e.index !== entry.index))
    setIsDirty(true)
    toast.success(`Port ${entry.index} (PORT=${entry.port}) geloescht.`)
  }

  async function checkRulesForPort(port: number) {
    try {
      const res = await fetch('/api/github/file?type=rules')
      if (!res.ok) return null
      const data = await res.json()
      return checkPortInRules(data.content, port)
    } catch {
      return null
    }
  }

  function handleCommitSuccess(result: GitHubCommitResponse) {
    // Update SHA and content after successful commit
    setCurrentSha(result.file_sha)
    const newContent = serializeInstanceProfile(portEntries, nonPortLines, lineMap)
    setOriginalContent(newContent)
    setIsDirty(false)

    // Update lineMap for the new state
    const newParsed = parseInstanceProfile(newContent)
    setLineMap(newParsed.lineMap)

    // Release lock
    fetch('/api/locks/instance_profile', { method: 'DELETE' }).catch(() => {})
    setLockState({ isLocked: false, isLockedByOther: false })

    // Re-acquire lock for continued editing
    setTimeout(async () => {
      try {
        const lockRes = await fetch('/api/locks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_type: 'instance_profile' }),
        })
        if (lockRes.ok) {
          const lockData = await lockRes.json()
          if (lockData.acquired) {
            setLockState({ isLocked: true, isLockedByOther: false })
          }
        }
      } catch {
        // Silent - user can refresh
      }
    }, 500)
  }

  async function handleForceRelease() {
    const res = await fetch('/api/locks/instance_profile', {
      method: 'DELETE',
    })
    if (res.ok) {
      // Re-load page to re-acquire lock
      loadFile()
    } else {
      const data = await res.json()
      throw new Error(data.error || 'Could not release lock')
    }
  }

  // Build modified content for diff
  const modifiedContent = serializeInstanceProfile(
    portEntries,
    nonPortLines,
    lineMap
  )

  // ─── Render ───────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-black tracking-tight">
            Instance Profile Port Editor
          </h1>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{errorMessage}</p>
            <Button variant="outline" size="sm" onClick={loadFile}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Dashboard
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              Instance Profile Port Editor
            </h1>
            <p className="text-sm text-muted-foreground">
              Verwalte <code className="text-xs bg-muted px-1 py-0.5 rounded">icm/server_port_*</code> Parameter
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadFile}
            aria-label="Datei neu laden"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Neu laden
          </Button>
          {!readOnly && (
            <Button
              size="sm"
              onClick={() => setCommitModalOpen(true)}
              disabled={!isDirty}
            >
              <Save className="h-4 w-4 mr-1" />
              Aenderungen speichern
            </Button>
          )}
        </div>
      </div>

      {/* Lock Status */}
      <LockStatusBanner
        isLocked={lockState.isLocked}
        isLockedByOther={lockState.isLockedByOther}
        lockedByName={lockState.lockedByName}
        lockedAt={lockState.lockedAt}
        isExpired={lockState.isExpired}
        isAdmin={isAdmin}
        onForceRelease={handleForceRelease}
      />

      {/* File Header */}
      {lastCommit && (
        <Card className="relative overflow-hidden">
          <CardHeader className="py-3 px-4">
            <div className="absolute top-0 bottom-0 left-0 w-1 consolut-gradient-v" />
            <CardTitle className="text-sm font-normal flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="font-mono text-xs">
                <GitCommit className="h-3 w-3 mr-1" />
                {lastCommit.sha.slice(0, 8)}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {lastCommit.author} -- {lastCommit.date ? new Date(lastCommit.date).toLocaleString('de-DE') : 'Unbekannt'}
              </span>
              <span className="text-muted-foreground text-xs font-mono">
                {filePath}
              </span>
              {isDirty && (
                <Badge variant="secondary" className="text-xs">
                  Ungespeicherte Aenderungen
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Port Table */}
      <PortTable
        entries={portEntries}
        readOnly={readOnly}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteRequest}
        onAdd={handleAdd}
      />

      {/* Read-only Parameters */}
      <ReadonlyParamsSection lines={nonPortLines} />

      {/* Port Form Dialog */}
      <PortForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        entry={formEntry}
        allEntries={portEntries}
        onSubmit={handleFormSubmit}
        rulesWarning={rulesWarning}
      />

      {/* Delete Confirmation Dialog */}
      <DeletePortDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        entry={deleteEntry}
        allEntries={portEntries}
        onConfirm={handleDeleteConfirm}
      />

      {/* Commit Modal */}
      <CommitModal
        open={commitModalOpen}
        onOpenChange={setCommitModalOpen}
        originalContent={originalContent}
        modifiedContent={modifiedContent}
        currentSha={currentSha}
        fileType="instance_profile"
        fileName={filePath}
        defaultMessage={`feat: Update icm/server_port configuration [${new Date().toISOString().slice(0, 16).replace('T', ' ')}]`}
        onCommitSuccess={handleCommitSuccess}
      />
    </div>
  )
}
