'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { GitCommit, Save, RefreshCw, ArrowLeft, Plus, FilePlus } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LockStatusBanner } from '@/components/port-editor/lock-status-banner'
import { PortSection } from '@/components/rules-editor/port-section'
import { GlobalRulesSection } from '@/components/rules-editor/global-rules-section'
import { RuleForm, buildActionParams } from '@/components/rules-editor/rule-form'
import type { RuleFormMode, RuleFormValues, PortInfo, ElseIfFormEntry, ElseFormEntry } from '@/components/rules-editor/rule-form'
import { DeleteRuleDialog } from '@/components/rules-editor/delete-rule-dialog'
import { CommitModal } from '@/components/github/commit-modal'
import {
  parseRules,
  serializeRules,
  groupRulesByPort,
} from '@/lib/rules-parser'
import type { RuleBlock, ElseIfBranch, RuleAction } from '@/lib/rules-parser'
import { validateRulesText } from '@/lib/rules-validator'
import { parseInstanceProfile } from '@/lib/port-parser'
import type { GitHubFileResponse, GitHubCommitResponse } from '@/lib/github-schema'
import { createClient } from '@/lib/supabase'

// Lazy import CodeMirror to avoid SSR issues
import dynamic from 'next/dynamic'
const CodeMirror = dynamic(
  () => import('@uiw/react-codemirror').then((mod) => mod.default),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
)

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

export default function RulesEditorPage() {
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
  const [rules, setRules] = useState<RuleBlock[]>([])
  const [preambleLines, setPreambleLines] = useState<string[]>([])
  const [trailingLines, setTrailingLines] = useState<string[]>([])
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [errorCode, setErrorCode] = useState<string | null>(null)

  // Port list from instance profile
  const [availablePorts, setAvailablePorts] = useState<PortInfo[]>([])

  // Raw text state (for raw text tab)
  const [rawText, setRawText] = useState('')
  const [activeTab, setActiveTab] = useState('structured')

  // Lock state
  const [lockState, setLockState] = useState<LockState>({
    isLocked: false,
    isLockedByOther: false,
  })
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)

  // UI state
  const [isDirty, setIsDirty] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<RuleFormMode>('add')
  const [formRule, setFormRule] = useState<RuleBlock | null>(null)
  const [preselectedPort, setPreselectedPort] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteRule, setDeleteRule] = useState<RuleBlock | null>(null)
  const [commitModalOpen, setCommitModalOpen] = useState(false)

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
      // Load rules.txt and instance profile in parallel
      const [rulesRes, profileRes] = await Promise.all([
        fetch('/api/github/file?type=rules'),
        fetch('/api/github/file?type=instance_profile'),
      ])

      // Handle rules.txt response
      if (!rulesRes.ok) {
        const data = await rulesRes.json()
        if (data.code === 'FILE_NOT_FOUND') {
          setErrorCode('FILE_NOT_FOUND')
          setErrorMessage(
            `Datei nicht gefunden: ${data.error}. Bitte pruefen Sie die Settings.`
          )
        } else {
          setErrorCode(null)
          setErrorMessage(data.error || 'rules.txt konnte nicht geladen werden.')
        }

        // Parse instance profile for port list even on file error (needed for create-file flow)
        if (profileRes.ok) {
          const profileData: GitHubFileResponse = await profileRes.json()
          const profileParsed = parseInstanceProfile(profileData.content)
          const ports: PortInfo[] = profileParsed.portEntries
            .filter((e) => e.port !== null)
            .map((e) => ({ port: e.port!, prot: e.prot }))
          setAvailablePorts(ports)
        }

        setPageState('error')
        return
      }

      const rulesData: GitHubFileResponse = await rulesRes.json()

      // Parse rules.txt
      const parsed = parseRules(rulesData.content)

      setOriginalContent(rulesData.content)
      setCurrentSha(rulesData.sha)
      setFilePath(rulesData.file_path)
      setLastCommit(rulesData.last_commit)
      setRules(parsed.rules)
      setPreambleLines(parsed.preambleLines)
      setTrailingLines(parsed.trailingLines)
      setParseWarnings(parsed.warnings)
      setRawText(rulesData.content)
      setIsDirty(false)

      // Parse instance profile for port list (non-blocking)
      if (profileRes.ok) {
        const profileData: GitHubFileResponse = await profileRes.json()
        const profileParsed = parseInstanceProfile(profileData.content)
        const ports: PortInfo[] = profileParsed.portEntries
          .filter((e) => e.port !== null)
          .map((e) => ({ port: e.port!, prot: e.prot }))
        setAvailablePorts(ports)
      } else {
        // Instance profile failed - still allow editor to work
        setAvailablePorts([])
      }

      // Try to acquire lock
      const lockRes = await fetch('/api/locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_type: 'rules' }),
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
          const res = await fetch('/api/locks/rules/heartbeat', {
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
        navigator.sendBeacon?.(
          '/api/locks/rules',
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
      if (lockState.isLocked && !lockState.isLockedByOther) {
        fetch('/api/locks/rules', { method: 'DELETE' }).catch(() => {})
      }
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [lockState.isLocked, lockState.isLockedByOther])

  // ─── Sync: structured model <-> raw text ──────────────────────

  // When structured model changes, update raw text
  useEffect(() => {
    if (activeTab === 'structured' && rules.length > 0) {
      const serialized = serializeRules(rules, preambleLines, trailingLines)
      setRawText(serialized)
    }
  }, [rules, preambleLines, trailingLines, activeTab])

  // When switching from raw to structured, re-parse
  function handleTabChange(tab: string) {
    if (tab === 'structured' && activeTab === 'raw') {
      // Re-parse raw text into structured model
      const parsed = parseRules(rawText)
      setRules(parsed.rules)
      setPreambleLines(parsed.preambleLines)
      setTrailingLines(parsed.trailingLines)
      setParseWarnings(parsed.warnings)
    }
    setActiveTab(tab)
  }

  function handleRawTextChange(value: string) {
    setRawText(value)
    setIsDirty(true)
  }

  // ─── Handlers ─────────────────────────────────────────────────

  function handleAddRule(port?: number) {
    setFormMode('add')
    setFormRule(null)
    setPreselectedPort(port ?? null)
    setFormOpen(true)
  }

  function handleEditRule(rule: RuleBlock) {
    setFormMode('edit')
    setFormRule(rule)
    setPreselectedPort(null)
    setFormOpen(true)
  }

  function handleDuplicateRule(rule: RuleBlock) {
    setFormMode('duplicate')
    setFormRule(rule)
    setPreselectedPort(null)
    setFormOpen(true)
  }

  function handleDeleteRequest(rule: RuleBlock) {
    setDeleteRule(rule)
    setDeleteDialogOpen(true)
  }

  function handleFormSubmit(
    values: RuleFormValues,
    mode: RuleFormMode,
    branchData?: { elseIfBranches: ElseIfFormEntry[]; elseBlock: ElseFormEntry | null }
  ) {
    const portNum = parseInt(values.port, 10)
    const actionType = values.actionType
    const actionParams = buildActionParams(values)

    // Convert form branch data to parser model types
    const newElseIfBranches: ElseIfBranch[] = branchData?.elseIfBranches
      ? branchData.elseIfBranches
          .filter((e) => e.condition.trim() || e.actionParams.trim())
          .map((e) => ({
            condition: e.condition,
            actions: [{ directive: e.actionType, params: e.actionParams }],
          }))
      : []

    const newElseActions: RuleAction[] = branchData?.elseBlock
      ? [{ directive: branchData.elseBlock.actionType, params: branchData.elseBlock.actionParams }]
      : []

    if (mode === 'edit' && formRule) {
      // Update existing rule — use branch data from form
      setRules((prev) =>
        prev.map((r) => {
          if (r.id !== formRule.id) return r
          // Build new actions: primary action from form replaces actions[0],
          // keep any additional actions (actions[1..]) from the original rule
          const additionalActions = r.actions.length > 1 ? r.actions.slice(1) : []
          return {
            ...r,
            port: portNum,
            isGlobal: false,
            comment: values.comment || '',
            additionalCondition: values.additionalCondition || '',
            actions: [{ directive: actionType, params: actionParams }, ...additionalActions],
            elseIfBranches: newElseIfBranches,
            elseActions: newElseActions,
            isComplex: false,
            rawLines: [],
          }
        })
      )
    } else if (mode === 'duplicate' && formRule) {
      // Duplicate: create new rule and insert after the original
      const newRule: RuleBlock = {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        comment: values.comment || '',
        port: portNum,
        additionalCondition: values.additionalCondition || '',
        actions: [{ directive: actionType, params: actionParams }],
        elseIfBranches: newElseIfBranches,
        elseActions: newElseActions,
        isComplex: false,
        isGlobal: false,
        rawLines: [],
        startLine: -1,
        endLine: -1,
        leadingLines: [],
      }
      setRules((prev) => {
        const originalIndex = prev.findIndex((r) => r.id === formRule.id)
        if (originalIndex === -1) {
          // Fallback: append to end
          return [...prev, newRule]
        }
        // Insert duplicate after the original
        const updated = [...prev]
        updated.splice(originalIndex + 1, 0, newRule)
        return updated
      })
    } else {
      // Add: create new rule and append to end
      const newRule: RuleBlock = {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        comment: values.comment || '',
        port: portNum,
        additionalCondition: values.additionalCondition || '',
        actions: [{ directive: actionType, params: actionParams }],
        elseIfBranches: newElseIfBranches,
        elseActions: newElseActions,
        isComplex: false,
        isGlobal: false,
        rawLines: [],
        startLine: -1,
        endLine: -1,
        leadingLines: [],
      }
      setRules((prev) => [...prev, newRule])
    }

    setIsDirty(true)
  }

  function handleDeleteConfirm(rule: RuleBlock) {
    setRules((prev) => prev.filter((r) => r.id !== rule.id))
    setIsDirty(true)
    toast.success(
      `Regel ${rule.comment ? `"${rule.comment}"` : `fuer Port ${rule.port ?? 'global'}`} geloescht.`
    )
  }

  function handleCommitSuccess(result: GitHubCommitResponse) {
    // Update SHA and content after successful commit
    setCurrentSha(result.file_sha)
    const newContent = activeTab === 'raw'
      ? rawText
      : serializeRules(rules, preambleLines, trailingLines)
    setOriginalContent(newContent)
    setIsDirty(false)

    // Re-parse to keep state consistent
    const newParsed = parseRules(newContent)
    setRules(newParsed.rules)
    setPreambleLines(newParsed.preambleLines)
    setTrailingLines(newParsed.trailingLines)
    setRawText(newContent)

    // Release lock
    fetch('/api/locks/rules', { method: 'DELETE' }).catch(() => {})
    setLockState({ isLocked: false, isLockedByOther: false })

    // Re-acquire lock for continued editing
    setTimeout(async () => {
      try {
        const lockRes = await fetch('/api/locks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_type: 'rules' }),
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
    const res = await fetch('/api/locks/rules', {
      method: 'DELETE',
    })
    if (res.ok) {
      loadFile()
    } else {
      const data = await res.json()
      throw new Error(data.error || 'Could not release lock')
    }
  }

  // Build modified content for diff
  const modifiedContent = activeTab === 'raw'
    ? rawText
    : serializeRules(rules, preambleLines, trailingLines)

  // Group rules by port for structured view
  const rulesByPort = groupRulesByPort(rules)
  const portRuleEntries = Array.from(rulesByPort.entries())
    .filter(([key]) => key !== -1)
    .sort(([a], [b]) => a - b)
  const globalRules = rulesByPort.get(-1) || []

  // Build a set of configured ports (from instance profile)
  const configuredPorts = new Set(availablePorts.map((p) => p.port))

  // Detect ports used in rules but not in instance profile
  const deletedPorts = new Set<number>()
  for (const [port] of portRuleEntries) {
    if (!configuredPorts.has(port)) {
      deletedPorts.add(port)
    }
  }

  // Build port-to-protocol map for display
  const portProtocolMap = new Map<number, string>()
  for (const p of availablePorts) {
    portProtocolMap.set(p.port, p.prot)
  }

  // Ensure all configured ports are shown even without rules
  const allPortNumbers = new Set([
    ...portRuleEntries.map(([port]) => port),
    ...availablePorts.map((p) => p.port),
  ])
  const sortedAllPorts = Array.from(allPortNumbers).sort((a, b) => a - b)

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

  function handleCreateEmptyFile() {
    // Set state to ready with empty content so user can commit a new empty file
    setOriginalContent('')
    setCurrentSha('')
    setFilePath('rules.txt')
    setLastCommit(null)
    setRules([])
    setPreambleLines([])
    setTrailingLines([])
    setParseWarnings([])
    setRawText('')
    setIsDirty(true)
    setErrorCode(null)
    setPageState('ready')
    // Open commit modal so user can commit the empty file
    setCommitModalOpen(true)
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
            Rules.txt Rewrite Editor
          </h1>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{errorMessage}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadFile}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Erneut versuchen
              </Button>
              {errorCode === 'FILE_NOT_FOUND' && (
                <Button variant="outline" size="sm" onClick={handleCreateEmptyFile}>
                  <FilePlus className="h-4 w-4 mr-1" />
                  Leere Datei anlegen
                </Button>
              )}
            </div>
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
              Rules.txt Rewrite Editor
            </h1>
            <p className="text-sm text-muted-foreground">
              Verwalte URL-Rewrite-Regeln fuer Routing und Weiterleitung
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
              onClick={() => {
                // Validate syntax before allowing commit (Fix #6)
                const contentToValidate = activeTab === 'raw'
                  ? rawText
                  : serializeRules(rules, preambleLines, trailingLines)
                const syntaxErrors = validateRulesText(contentToValidate)
                  .filter((f) => f.severity === 'error')
                if (syntaxErrors.length > 0) {
                  for (const err of syntaxErrors) {
                    toast.error(err.message)
                  }
                  return
                }
                setCommitModalOpen(true)
              }}
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

      {/* Parse Warnings */}
      {parseWarnings.length > 0 && (
        <Alert className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/30">
          <AlertTitle className="text-orange-800 dark:text-orange-200">
            Parse-Warnungen
          </AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            <ul className="list-disc list-inside text-sm space-y-1">
              {parseWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

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

      {/* Tabs: Structured / Raw */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="structured">Strukturierte Ansicht</TabsTrigger>
            <TabsTrigger value="raw">Raw-Text</TabsTrigger>
          </TabsList>

          {activeTab === 'structured' && !readOnly && (
            <Button
              size="sm"
              onClick={() => handleAddRule()}
              disabled={availablePorts.length === 0}
              title={
                availablePorts.length === 0
                  ? 'Keine Ports im Instance Profile konfiguriert. Bitte zuerst Ports anlegen.'
                  : undefined
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Neue Regel
            </Button>
          )}
        </div>

        {/* No ports warning */}
        {availablePorts.length === 0 && activeTab === 'structured' && (
          <Alert className="mt-4">
            <AlertDescription className="text-sm">
              Keine Ports im Instance Profile konfiguriert. Bitte zuerst im{' '}
              <Link href="/editor/instance-profile" className="underline font-medium">
                Port Editor
              </Link>{' '}
              Ports anlegen, bevor neue Regeln erstellt werden.
            </AlertDescription>
          </Alert>
        )}

        {/* Structured View */}
        <TabsContent value="structured" className="space-y-4">
          {sortedAllPorts.length === 0 && globalRules.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">
                Keine Regeln vorhanden. Fuege die erste Regel hinzu.
              </p>
            </div>
          )}

          {sortedAllPorts.map((port) => {
            const portRules = rulesByPort.get(port) || []
            const protocol = portProtocolMap.get(port) || 'HTTP'
            return (
              <PortSection
                key={port}
                port={port}
                protocol={protocol}
                rules={portRules}
                readOnly={readOnly}
                deletedPorts={deletedPorts}
                onAddRule={handleAddRule}
                onEditRule={handleEditRule}
                onDuplicateRule={handleDuplicateRule}
                onDeleteRule={handleDeleteRequest}
              />
            )
          })}

          {/* Global rules section */}
          <GlobalRulesSection
            rules={globalRules}
            readOnly={readOnly}
            onEditRule={handleEditRule}
            onDuplicateRule={handleDuplicateRule}
            onDeleteRule={handleDeleteRequest}
          />
        </TabsContent>

        {/* Raw Text View */}
        <TabsContent value="raw">
          <div className="border rounded-lg overflow-hidden">
            <CodeMirror
              value={rawText}
              height="500px"
              editable={!readOnly}
              onChange={handleRawTextChange}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                highlightActiveLine: !readOnly,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {readOnly
              ? 'Nur-Lesen-Modus. Aenderungen im Raw-Text sind deaktiviert.'
              : 'Aenderungen im Raw-Text werden beim Tab-Wechsel automatisch geparsed.'}
          </p>
        </TabsContent>
      </Tabs>

      {/* Rule Form Dialog */}
      <RuleForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        rule={formRule}
        preselectedPort={preselectedPort}
        availablePorts={availablePorts}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteRuleDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        rule={deleteRule}
        onConfirm={handleDeleteConfirm}
      />

      {/* Commit Modal */}
      <CommitModal
        open={commitModalOpen}
        onOpenChange={setCommitModalOpen}
        originalContent={originalContent}
        modifiedContent={modifiedContent}
        currentSha={currentSha}
        fileType="rules"
        fileName={filePath}
        defaultMessage={(() => {
          const now = new Date()
          const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
          return `feat: Update rules.txt [${ts}]`
        })()}
        onCommitSuccess={handleCommitSuccess}
      />
    </div>
  )
}
