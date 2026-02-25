'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { checkPortInRules } from '@/lib/rules-integrity'
import type { PortEntry } from '@/lib/port-parser'

interface DeletePortDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: PortEntry | null
  allEntries: PortEntry[]
  onConfirm: (entry: PortEntry) => void
}

export function DeletePortDialog({
  open,
  onOpenChange,
  entry,
  allEntries,
  onConfirm,
}: DeletePortDialogProps) {
  const [isCheckingRules, setIsCheckingRules] = useState(false)
  const [rulesCheckDone, setRulesCheckDone] = useState(false)
  const [rulesMatchCount, setRulesMatchCount] = useState(0)
  const [rulesMatched, setRulesMatched] = useState<string[]>([])
  const [rulesCheckError, setRulesCheckError] = useState<string | null>(null)

  // Check rules integrity when dialog opens
  useEffect(() => {
    if (!open || !entry || entry.port === null) {
      setRulesCheckDone(false)
      setRulesMatchCount(0)
      setRulesMatched([])
      setRulesCheckError(null)
      return
    }

    async function checkRules() {
      setIsCheckingRules(true)
      setRulesCheckError(null)

      try {
        const res = await fetch('/api/github/file?type=rules')

        if (res.status === 404) {
          // rules.txt does not exist - no integrity issue
          setRulesCheckDone(true)
          setRulesMatchCount(0)
          setRulesMatched([])
          return
        }

        if (!res.ok) {
          setRulesCheckError(
            'Rules-Integritaetspruefung nicht moeglich -- bitte rules.txt manuell pruefen.'
          )
          setRulesCheckDone(true)
          return
        }

        const data = await res.json()
        const result = checkPortInRules(data.content, entry!.port!)
        setRulesMatchCount(result.matchCount)
        setRulesMatched(result.matchedRules)
        setRulesCheckDone(true)
      } catch {
        setRulesCheckError(
          'Rules-Integritaetspruefung nicht moeglich -- bitte rules.txt manuell pruefen.'
        )
        setRulesCheckDone(true)
      } finally {
        setIsCheckingRules(false)
      }
    }

    checkRules()
  }, [open, entry])

  if (!entry) return null

  const isLastPort = allEntries.length === 1

  function handleConfirm() {
    if (entry) {
      onConfirm(entry)
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Port loeschen
          </AlertDialogTitle>
          <AlertDialogDescription>
            Port {entry.index} (PROT={entry.prot}, PORT={entry.port}) wirklich loeschen?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {/* Loading state during rules check */}
          {isCheckingRules && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Pruefe Rewrite-Rules auf Port-Referenzen...
            </div>
          )}

          {/* Rules check error */}
          {rulesCheckError && (
            <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/30">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-200">
                Warnung
              </AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-300 text-sm">
                {rulesCheckError}
              </AlertDescription>
            </Alert>
          )}

          {/* Rules found for this port */}
          {rulesCheckDone && rulesMatchCount > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                Achtung: {rulesMatchCount} Rewrite-Rule{rulesMatchCount > 1 ? 's' : ''} gefunden
              </AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Es existieren {rulesMatchCount} Rewrite-Rules in rules.txt die Port{' '}
                  {entry.port} referenzieren:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {rulesMatched.map((rule, i) => (
                    <li key={i} className="text-xs font-mono truncate">
                      {rule}
                    </li>
                  ))}
                </ul>
                <p className="text-xs mt-2">
                  Wenn du den Port loeschst, bleiben die Rules bestehen und werden inkonsistent.
                  Passe die Rules anschliessend im Rules-Editor an.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Warning: all ports deleted */}
          {isLastPort && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Alle Ports geloescht</AlertTitle>
              <AlertDescription className="text-sm">
                Dies ist der letzte Port-Eintrag. Nach dem Loeschen wird der Web Dispatcher
                nicht mehr erreichbar sein.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isCheckingRules}
          >
            {rulesMatchCount > 0
              ? 'Nur Port loeschen (Rules bleiben)'
              : 'Loeschen'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
