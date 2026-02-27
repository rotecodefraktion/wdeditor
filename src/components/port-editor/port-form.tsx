'use client'

import { useEffect } from 'react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { PROTOCOLS, KNOWN_PORT_KEYS } from '@/lib/port-parser'
import type { PortEntry } from '@/lib/port-parser'

/** Form mode: add new, edit existing, or duplicate */
export type PortFormMode = 'add' | 'edit' | 'duplicate'

interface PortFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: PortFormMode
  /** The entry to edit/duplicate (null for add) */
  entry: PortEntry | null
  /** All current port entries (for uniqueness validation) */
  allEntries: PortEntry[]
  /** Callback when form is submitted */
  onSubmit: (data: PortFormValues, mode: PortFormMode) => void
  /** Warning about rules referencing the old port (for edit mode) */
  rulesWarning?: string | null
}

// Schema is created inside the component to access translations
// This is the type definition only
const portFormSchemaBase = z.object({
  prot: z.string(),
  port: z.string(),
  timeout: z.string().optional(),
  host: z.string().optional(),
  vclient: z.string().optional(),
  sslconfig: z.string().optional(),
  extraParams: z.string().optional(),
  comment: z.string().optional(),
})

export type PortFormValues = z.infer<typeof portFormSchemaBase>

export function PortForm({
  open,
  onOpenChange,
  mode,
  entry,
  allEntries,
  onSubmit,
  rulesWarning,
}: PortFormProps) {
  const t = useTranslations('portEditor')
  const tc = useTranslations('common')
  const tv = useTranslations('validation')

  const portFormSchema = z.object({
    prot: z.string().min(1, tv('protocolRequired')),
    port: z
      .string()
      .min(1, tv('portRequired'))
      .refine((val) => {
        const num = parseInt(val, 10)
        return !isNaN(num) && num >= 1 && num <= 65535
      }, tv('portRange')),
    timeout: z.string().optional(),
    host: z.string().optional(),
    vclient: z.string().optional(),
    sslconfig: z.string().optional(),
    extraParams: z.string().optional(),
    comment: z
      .string()
      .max(200, tv('commentMaxLength'))
      .optional(),
  })

  const form = useForm<PortFormValues>({
    resolver: zodResolver(portFormSchema),
    defaultValues: {
      prot: 'HTTP',
      port: '',
      timeout: '60',
      host: '',
      vclient: '',
      sslconfig: '',
      extraParams: '',
      comment: '',
    },
  })

  const watchedProt = form.watch('prot')

  // Reset form when modal opens with entry data
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && entry) {
        form.reset({
          prot: entry.prot || 'HTTP',
          port: entry.port?.toString() || '',
          timeout: entry.timeout?.toString() || '',
          host: entry.host || '',
          vclient: entry.vclient || '',
          sslconfig: entry.sslconfig || '',
          extraParams: formatExtraParams(entry.extraParams),
          comment: (entry.comment || '').slice(0, 200),
        })
      } else if (mode === 'duplicate' && entry) {
        form.reset({
          prot: entry.prot || 'HTTP',
          port: '', // Port intentionally left empty for duplicate
          timeout: entry.timeout?.toString() || '',
          host: entry.host || '',
          vclient: entry.vclient || '',
          sslconfig: entry.sslconfig || '',
          extraParams: formatExtraParams(entry.extraParams),
          comment: (entry.comment || '').slice(0, 200), // Copy comment for duplication
        })
      } else {
        form.reset({
          prot: 'HTTP',
          port: '',
          timeout: '60',
          host: '',
          vclient: '',
          sslconfig: '',
          extraParams: '',
          comment: '',
        })
      }
    }
  }, [open, mode, entry, form])

  function handleSubmit(values: PortFormValues) {
    // Check port uniqueness
    const portNum = parseInt(values.port, 10)
    const excludeIndex = mode === 'edit' ? entry?.index : undefined
    const isDuplicate = allEntries.some(
      (e) => e.port === portNum && e.index !== excludeIndex
    )

    if (isDuplicate) {
      form.setError('port', {
        message: `Port ${portNum} wird bereits von einem anderen Eintrag verwendet.`,
      })
      return
    }

    // Check for unknown keys in extraParams
    if (values.extraParams?.trim()) {
      const pairs = values.extraParams.split(',').map((p) => p.trim())
      const knownSet = new Set<string>(KNOWN_PORT_KEYS)
      const unknowns: string[] = []
      for (const pair of pairs) {
        const key = pair.split('=')[0]?.trim().toUpperCase()
        if (key && !knownSet.has(key)) {
          unknowns.push(key)
        }
      }
      if (unknowns.length > 0) {
        toast.warning(`Unbekannte Parameter: ${unknowns.join(', ')} – bitte prüfen`)
      }
    }

    // Sanitize extraParams and comment: strip newlines to prevent injection into config file
    const sanitizedValues = {
      ...values,
      extraParams: values.extraParams?.replace(/[\n\r\0]/g, '') ?? '',
      comment: values.comment?.replace(/[\n\r\0]/g, '').trim() || '',
    }

    onSubmit(sanitizedValues, mode)
    onOpenChange(false)
  }

  const title =
    mode === 'add'
      ? 'Neuer Port'
      : mode === 'edit'
        ? `Port bearbeiten (Index ${entry?.index})`
        : 'Port duplizieren'

  const description =
    mode === 'add'
      ? 'Neuen icm/server_port Eintrag hinzufuegen.'
      : mode === 'edit'
        ? 'Bestehenden Port-Eintrag bearbeiten.'
        : 'Port-Eintrag duplizieren mit neuem Port-Wert.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Protocol */}
            <FormField
              control={form.control}
              name="prot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Protokoll *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Protokoll waehlen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PROTOCOLS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Port */}
            <FormField
              control={form.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={65535}
                      placeholder="z.B. 443"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Muss zwischen 1 und 65535 liegen und eindeutig sein.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Timeout */}
            <FormField
              control={form.control}
              name="timeout"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timeout (Sekunden)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="60"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Optional. Standard: 60 Sekunden.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Host */}
            <FormField
              control={form.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* HTTPS-specific fields */}
            {watchedProt === 'HTTPS' && (
              <>
                <FormField
                  control={form.control}
                  name="vclient"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VCLIENT</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Nicht gesetzt" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="not_set">Nicht gesetzt</SelectItem>
                          <SelectItem value="0">0 (aus)</SelectItem>
                          <SelectItem value="1">1 (an)</SelectItem>
                          <SelectItem value="2">2 (optional)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Client-Zertifikat-Validierung fuer HTTPS.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sslconfig"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SSLCONFIG</FormLabel>
                      <FormControl>
                        <Input placeholder="z.B. ssl_config" {...field} />
                      </FormControl>
                      <FormDescription>SSL-Konfigurationsname fuer HTTPS.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Extra Parameters */}
            <FormField
              control={form.control}
              name="extraParams"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weitere Parameter</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z.B. EXTBIND=1,KEEPALIVE=60"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Komma-getrennt im Format KEY=VALUE. Bekannte Schluessel: EXTBIND, NOLISTEN, PROCTIMEOUT, KEEPALIVE.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Comment */}
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kommentar</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z.B. Externer HTTP-Eingang fuer Load Balancer"
                      maxLength={200}
                      {...field}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional. Wird als # Kommentar vor dem Port-Eintrag in der Datei gespeichert (max. 200 Zeichen).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rules warning for edit mode */}
            {rulesWarning && (
              <Alert className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/30">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-700 dark:text-orange-300 text-sm">
                  {rulesWarning}
                </AlertDescription>
              </Alert>
            )}

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
 * Format extra params record into comma-separated string for display in the form.
 */
function formatExtraParams(params: Record<string, string>): string {
  const filtered = Object.entries(params).filter(
    ([key]) => !['PROT', 'PORT', 'TIMEOUT', 'HOST', 'VCLIENT', 'SSLCONFIG'].includes(key)
  )
  return filtered.map(([k, v]) => `${k}=${v}`).join(',')
}
