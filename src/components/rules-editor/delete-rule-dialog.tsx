'use client'

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
  const t = useTranslations('rulesEditor')
  const tc = useTranslations('common')
  if (!rule) return null

  const description = rule.comment
    ? t('deleteRuleDescriptionNamed', { comment: rule.comment, port: String(rule.port ?? 'global') })
    : t('deleteRuleDescriptionPort', { port: String(rule.port ?? 'global') })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteRuleTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              onConfirm(rule)
              onOpenChange(false)
            }}
          >
            {tc('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
