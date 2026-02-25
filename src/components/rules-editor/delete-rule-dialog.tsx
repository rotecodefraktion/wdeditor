'use client'

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
import type { RuleBlock } from '@/lib/rules-parser'

interface DeleteRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: RuleBlock | null
  onConfirm: (rule: RuleBlock) => void
}

export function DeleteRuleDialog({
  open,
  onOpenChange,
  rule,
  onConfirm,
}: DeleteRuleDialogProps) {
  if (!rule) return null

  const description = rule.comment
    ? `"${rule.comment}" (Port ${rule.port ?? 'global'})`
    : `Regel fuer Port ${rule.port ?? 'global'}`

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Regel loeschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Soll die Regel {description} wirklich geloescht werden?
            Die Regel wird vollstaendig aus der Datei entfernt (inkl. Kommentarzeile).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              onConfirm(rule)
              onOpenChange(false)
            }}
          >
            Loeschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
