'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, CheckCircle, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { validateDirective, validateCondition } from '@/lib/rules-validator'
import type { RuleBlock, ActionType, ElseIfBranch, RuleAction } from '@/lib/rules-parser'
import { ACTION_TYPES } from '@/lib/rules-parser'

/** Port info from instance profile */
export interface PortInfo {
  port: number
  prot: string
}

/** Form mode: add new, edit existing, or duplicate */
export type RuleFormMode = 'add' | 'edit' | 'duplicate'

/** ElseIf branch entry as managed in the form */
export interface ElseIfFormEntry {
  id: string
  condition: string
  actionType: ActionType
  actionParams: string
}

/** Else block entry as managed in the form */
export interface ElseFormEntry {
  actionType: ActionType
  actionParams: string
}

/** Extended form submit data including branch info */
export interface RuleFormSubmitData {
  values: RuleFormValues
  elseIfBranches: ElseIfFormEntry[]
  elseBlock: ElseFormEntry | null
}

interface RuleFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: RuleFormMode
  /** The rule to edit/duplicate (null for add) */
  rule: RuleBlock | null
  /** Port to pre-select when adding from a port section */
  preselectedPort?: number | null
  /** Available ports from instance profile */
  availablePorts: PortInfo[]
  /** Callback when form is submitted */
  onSubmit: (data: RuleFormValues, mode: RuleFormMode, branchData?: { elseIfBranches: ElseIfFormEntry[]; elseBlock: ElseFormEntry | null }) => void
}

const ACTION_TYPE_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'Forward', label: 'Forward' },
  { value: 'Redirect', label: 'Redirect' },
  { value: 'Rewrite', label: 'Rewrite' },
  { value: 'Deny', label: 'Deny' },
  { value: 'SetHeader', label: 'SetHeader' },
  { value: 'RemoveHeader', label: 'RemoveHeader' },
  { value: 'SetEnvIf', label: 'SetEnvIf' },
  { value: 'Pass', label: 'Pass' },
]

const REDIRECT_CODES = ['301', '302'] as const

const ruleFormSchema = z.object({
  port: z.string().min(1, 'Port ist erforderlich'),
  comment: z.string().optional(),
  additionalCondition: z.string().optional(),
  actionType: z.string().min(1, 'Aktionstyp ist erforderlich'),
  // Dynamic action params
  forwardUrl: z.string().optional(),
  redirectCode: z.string().optional(),
  redirectUrl: z.string().optional(),
  rewriteUrl: z.string().optional(),
  headerName: z.string().optional(),
  headerValue: z.string().optional(),
  setEnvIfParams: z.string().optional(),
})

export type RuleFormValues = z.infer<typeof ruleFormSchema>

/** Generate a unique ID for form entries */
function generateFormId(): string {
  return `fe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/** Convert a parsed ElseIfBranch to form entry */
function elseIfBranchToFormEntry(branch: ElseIfBranch): ElseIfFormEntry {
  const action = branch.actions[0]
  const actionType = action ? resolveActionType(action.directive) : 'Forward'
  const actionParams = action ? action.params : ''
  return {
    id: generateFormId(),
    condition: branch.condition,
    actionType,
    actionParams,
  }
}

/** Convert parsed Else actions to form entry */
function elseActionsToFormEntry(actions: RuleAction[]): ElseFormEntry | null {
  if (actions.length === 0) return null
  const action = actions[0]
  const actionType = resolveActionType(action.directive)
  return {
    actionType,
    actionParams: action.params,
  }
}

export function RuleForm({
  open,
  onOpenChange,
  mode,
  rule,
  preselectedPort,
  availablePorts,
  onSubmit,
}: RuleFormProps) {
  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      port: '',
      comment: '',
      additionalCondition: '',
      actionType: 'Forward',
      forwardUrl: '',
      redirectCode: '301',
      redirectUrl: '',
      rewriteUrl: '',
      headerName: '',
      headerValue: '',
      setEnvIfParams: '',
    },
  })

  // ElseIf/Else branch state
  const [elseIfEntries, setElseIfEntries] = useState<ElseIfFormEntry[]>([])
  const [elseEntry, setElseEntry] = useState<ElseFormEntry | null>(null)

  const watchedActionType = form.watch('actionType')
  const watchedCondition = form.watch('additionalCondition')

  // Inline condition validation feedback
  const conditionFeedback = useMemo(() => {
    if (!watchedCondition?.trim()) return []
    return validateCondition(watchedCondition)
  }, [watchedCondition])

  const conditionOks = conditionFeedback.filter(
    (f) => f.severity === 'ok'
  )
  const conditionWarnings = conditionFeedback.filter(
    (f) => f.severity === 'warning'
  )

  // Reset form when modal opens with rule data
  useEffect(() => {
    if (!open) return

    if ((mode === 'edit' || mode === 'duplicate') && rule) {
      const primaryAction = rule.actions[0]
      const actionType = primaryAction
        ? resolveActionType(primaryAction.directive)
        : 'Forward'

      const actionParams = extractActionParams(
        actionType,
        primaryAction?.params || ''
      )

      form.reset({
        port: rule.port?.toString() || '',
        comment:
          mode === 'duplicate' && rule.comment
            ? `${rule.comment} (Kopie)`
            : rule.comment || '',
        additionalCondition: rule.additionalCondition || '',
        actionType,
        ...actionParams,
      })

      // Pre-fill ElseIf/Else branches from the existing rule
      setElseIfEntries(
        rule.elseIfBranches.map(elseIfBranchToFormEntry)
      )
      setElseEntry(elseActionsToFormEntry(rule.elseActions))
    } else {
      // Add mode
      form.reset({
        port: preselectedPort?.toString() || '',
        comment: '',
        additionalCondition: '',
        actionType: 'Forward',
        forwardUrl: '',
        redirectCode: '301',
        redirectUrl: '',
        rewriteUrl: '',
        headerName: '',
        headerValue: '',
        setEnvIfParams: '',
      })
      setElseIfEntries([])
      setElseEntry(null)
    }
  }, [open, mode, rule, preselectedPort, form])

  // ─── ElseIf/Else handlers ──────────────────────────────────

  const handleAddElseIf = useCallback(() => {
    setElseIfEntries((prev) => [
      ...prev,
      {
        id: generateFormId(),
        condition: '',
        actionType: 'Forward' as ActionType,
        actionParams: '',
      },
    ])
  }, [])

  const handleRemoveElseIf = useCallback((id: string) => {
    setElseIfEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const handleElseIfChange = useCallback(
    (id: string, field: 'condition' | 'actionType' | 'actionParams', value: string) => {
      setElseIfEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
      )
    },
    []
  )

  const handleAddElse = useCallback(() => {
    setElseEntry({ actionType: 'Forward', actionParams: '' })
  }, [])

  const handleRemoveElse = useCallback(() => {
    setElseEntry(null)
  }, [])

  const handleElseChange = useCallback(
    (field: 'actionType' | 'actionParams', value: string) => {
      setElseEntry((prev) => (prev ? { ...prev, [field]: value } : null))
    },
    []
  )

  function handleSubmit(values: RuleFormValues) {
    // Validate action-specific params
    const actionType = values.actionType as ActionType

    // Validate directive
    const directiveResult = validateDirective(actionType)
    if (directiveResult.severity === 'error') {
      form.setError('actionType', { message: directiveResult.message })
      return
    }

    // Validate action params based on type
    switch (actionType) {
      case 'Forward':
        if (!values.forwardUrl?.trim()) {
          form.setError('forwardUrl', { message: 'URL ist erforderlich fuer Forward' })
          return
        }
        break
      case 'Redirect':
        if (!values.redirectUrl?.trim()) {
          form.setError('redirectUrl', { message: 'URL ist erforderlich fuer Redirect' })
          return
        }
        break
      case 'Rewrite':
        if (!values.rewriteUrl?.trim()) {
          form.setError('rewriteUrl', { message: 'URL ist erforderlich fuer Rewrite' })
          return
        }
        break
      case 'SetHeader':
        if (!values.headerName?.trim()) {
          form.setError('headerName', { message: 'Header-Name ist erforderlich' })
          return
        }
        if (!values.headerValue?.trim()) {
          form.setError('headerValue', { message: 'Header-Wert ist erforderlich' })
          return
        }
        break
      case 'RemoveHeader':
        if (!values.headerName?.trim()) {
          form.setError('headerName', { message: 'Header-Name ist erforderlich' })
          return
        }
        break
      case 'SetEnvIf':
        if (!values.setEnvIfParams?.trim()) {
          form.setError('setEnvIfParams', { message: 'Parameter sind erforderlich fuer SetEnvIf' })
          return
        }
        break
    }

    onSubmit(values, mode, {
      elseIfBranches: elseIfEntries,
      elseBlock: elseEntry,
    })
    onOpenChange(false)
  }

  const title =
    mode === 'add'
      ? 'Neue Regel'
      : mode === 'edit'
        ? 'Regel bearbeiten'
        : 'Regel duplizieren'

  const description =
    mode === 'add'
      ? 'Neue Rewrite-Regel hinzufuegen.'
      : mode === 'edit'
        ? 'Bestehende Regel bearbeiten.'
        : 'Regel duplizieren mit neuem Namen.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* Port */}
            <FormField
              control={form.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Port waehlen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availablePorts.map((p) => (
                        <SelectItem
                          key={p.port}
                          value={p.port.toString()}
                        >
                          {p.prot} &middot; {p.port}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Port aus dem Instance Profile.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Comment / Name */}
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kommentar / Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z.B. App Weiterleitung"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Wird als Kommentarzeile (#) ueber der Regel angezeigt.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Additional condition */}
            <FormField
              control={form.control}
              name="additionalCondition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zusaetzliche Bedingung</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z.B. %{PATH} = ^/myapp/(.*)$"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Wird mit &amp;&amp; nach der Port-Bedingung angehaengt. Optional.
                  </FormDescription>
                  {conditionFeedback.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {conditionOks.map((f, idx) => (
                        <Badge key={`ok-${idx}`} variant="outline" className="text-xs border-green-500/50 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {f.message}
                        </Badge>
                      ))}
                      {conditionWarnings.map((f, idx) => (
                        <Badge key={`warn-${idx}`} variant="outline" className="text-xs border-orange-500/50 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {f.message}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action type */}
            <FormField
              control={form.control}
              name="actionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aktionstyp *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Aktionstyp waehlen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACTION_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dynamic action parameters */}
            {watchedActionType === 'Forward' && (
              <FormField
                control={form.control}
                name="forwardUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ziel-URL *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. https://backend:8443/app/$1"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      URL, an die der Request weitergeleitet wird.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {watchedActionType === 'Redirect' && (
              <>
                <FormField
                  control={form.control}
                  name="redirectCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status Code *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || '301'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Status Code" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REDIRECT_CODES.map((code) => (
                            <SelectItem key={code} value={code}>
                              {code} ({code === '301' ? 'Permanent' : 'Temporary'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="redirectUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Redirect-URL *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="z.B. https://example.com/new-path"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {watchedActionType === 'Rewrite' && (
              <FormField
                control={form.control}
                name="rewriteUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rewrite-URL *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. /new-path/$1"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Neuer URL-Pfad fuer die Anfrage.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {(watchedActionType === 'SetHeader' ||
              watchedActionType === 'RemoveHeader') && (
              <>
                <FormField
                  control={form.control}
                  name="headerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Header-Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="z.B. X-Forwarded-Proto"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedActionType === 'SetHeader' && (
                  <FormField
                    control={form.control}
                    name="headerValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header-Wert *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="z.B. https"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

            {watchedActionType === 'SetEnvIf' && (
              <FormField
                control={form.control}
                name="setEnvIfParams"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parameter *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. Host ^www\\.example\\.com$ USE_SSL=1"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Format: variable regex wert (z.B. Host ^www\\.example\\.com$ USE_SSL=1)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Deny and Pass need no extra params */}
            {(watchedActionType === 'Deny' ||
              watchedActionType === 'Pass') && (
              <p className="text-sm text-muted-foreground">
                Keine weiteren Parameter erforderlich fuer {watchedActionType}.
              </p>
            )}

            {/* ─── ElseIf / Else Branches ─────────────────────── */}
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-medium">
                ElseIf / Else Bloecke (optional)
              </p>

              {elseIfEntries.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="rounded-md border p-3 space-y-2 bg-muted/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      ElseIf #{idx + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveElseIf(entry.id)}
                      aria-label={`ElseIf ${idx + 1} entfernen`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div>
                    <label className="text-xs font-medium" htmlFor={`elseif-cond-${entry.id}`}>
                      Bedingung *
                    </label>
                    <Input
                      id={`elseif-cond-${entry.id}`}
                      placeholder="z.B. %{PATH} = ^/other/(.*)$"
                      value={entry.condition}
                      onChange={(e) =>
                        handleElseIfChange(entry.id, 'condition', e.target.value)
                      }
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium" htmlFor={`elseif-action-${entry.id}`}>
                        Aktionstyp *
                      </label>
                      <Select
                        value={entry.actionType}
                        onValueChange={(val) =>
                          handleElseIfChange(entry.id, 'actionType', val)
                        }
                      >
                        <SelectTrigger id={`elseif-action-${entry.id}`} className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium" htmlFor={`elseif-params-${entry.id}`}>
                        Parameter
                      </label>
                      <Input
                        id={`elseif-params-${entry.id}`}
                        placeholder="z.B. https://backend/..."
                        value={entry.actionParams}
                        onChange={(e) =>
                          handleElseIfChange(entry.id, 'actionParams', e.target.value)
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {elseEntry && (
                <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Else
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveElse}
                      aria-label="Else-Block entfernen"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium" htmlFor="else-action">
                        Aktionstyp *
                      </label>
                      <Select
                        value={elseEntry.actionType}
                        onValueChange={(val) =>
                          handleElseChange('actionType', val)
                        }
                      >
                        <SelectTrigger id="else-action" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium" htmlFor="else-params">
                        Parameter
                      </label>
                      <Input
                        id="else-params"
                        placeholder="z.B. https://fallback/..."
                        value={elseEntry.actionParams}
                        onChange={(e) =>
                          handleElseChange('actionParams', e.target.value)
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddElseIf}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  ElseIf-Block hinzufuegen
                </Button>
                {!elseEntry && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddElse}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Else-Block hinzufuegen
                  </Button>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit">
                {mode === 'edit' ? 'Speichern' : 'Hinzufuegen'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Resolve a directive string to one of the known ActionType values.
 */
function resolveActionType(directive: string): ActionType {
  const lower = directive.toLowerCase()
  for (const at of ACTION_TYPES) {
    if (at.toLowerCase() === lower) return at
  }
  return 'Forward'
}

/**
 * Extract action params from the raw params string based on action type.
 */
function extractActionParams(
  actionType: ActionType,
  params: string
): Partial<RuleFormValues> {
  switch (actionType) {
    case 'Forward':
      return { forwardUrl: params }
    case 'Redirect': {
      // Redirect params format: "<code> <url>" or just "<url>"
      const parts = params.trim().split(/\s+/)
      if (parts.length >= 2 && /^\d{3}$/.test(parts[0])) {
        return {
          redirectCode: parts[0],
          redirectUrl: parts.slice(1).join(' '),
        }
      }
      return { redirectCode: '301', redirectUrl: params }
    }
    case 'Rewrite':
      return { rewriteUrl: params }
    case 'SetHeader': {
      // SetHeader params format: "<name>: <value>" (colon-separated) or "<name> <value>" (legacy space-separated)
      const colonIdx = params.indexOf(':')
      if (colonIdx > 0) {
        return {
          headerName: params.slice(0, colonIdx).trim(),
          headerValue: params.slice(colonIdx + 1).trim(),
        }
      }
      // Fallback: space-separated
      const spaceIdx = params.indexOf(' ')
      if (spaceIdx > 0) {
        return {
          headerName: params.slice(0, spaceIdx),
          headerValue: params.slice(spaceIdx + 1).trim(),
        }
      }
      return { headerName: params, headerValue: '' }
    }
    case 'RemoveHeader':
      return { headerName: params.trim() }
    case 'SetEnvIf':
      return { setEnvIfParams: params }
    case 'Deny':
    case 'Pass':
      return {}
    default:
      return { forwardUrl: params }
  }
}

/**
 * Build the action params string from form values.
 * Called by the parent page when processing form submission.
 */
export function buildActionParams(values: RuleFormValues): string {
  const actionType = values.actionType as ActionType
  switch (actionType) {
    case 'Forward':
      return values.forwardUrl?.trim() || ''
    case 'Redirect': {
      const code = values.redirectCode || '301'
      const url = values.redirectUrl?.trim() || ''
      return `${code} ${url}`
    }
    case 'Rewrite':
      return values.rewriteUrl?.trim() || ''
    case 'SetHeader': {
      const name = values.headerName?.trim() || ''
      const value = values.headerValue?.trim() || ''
      return `${name}: ${value}`
    }
    case 'RemoveHeader':
      return values.headerName?.trim() || ''
    case 'SetEnvIf':
      return values.setEnvIfParams?.trim() || ''
    case 'Deny':
    case 'Pass':
      return ''
    default:
      return ''
  }
}
