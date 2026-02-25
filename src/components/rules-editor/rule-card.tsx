'use client'

import { Copy, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { RuleBlock } from '@/lib/rules-parser'

interface RuleCardProps {
  rule: RuleBlock
  readOnly: boolean
  /** Whether the rule's port is no longer configured in the instance profile */
  portDeleted?: boolean
  /** Whether this rule is in the global (non-port-scoped) section */
  isGlobal?: boolean
  onEdit: (rule: RuleBlock) => void
  onDuplicate: (rule: RuleBlock) => void
  onDelete: (rule: RuleBlock) => void
}

export function RuleCard({
  rule,
  readOnly,
  portDeleted,
  isGlobal,
  onEdit,
  onDuplicate,
  onDelete,
}: RuleCardProps) {
  // Format actions for display
  const actionSummary = rule.actions
    .map((a) => `${a.directive}${a.params ? ' ' + a.params : ''}`)
    .join('; ')

  const hasElseIf = rule.elseIfBranches.length > 0
  const hasElse = rule.elseActions.length > 0

  return (
    <Card className="group">
      <CardHeader className="py-3 px-4 flex flex-row items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {rule.comment && (
              <span className="text-sm font-medium truncate">
                {rule.comment}
              </span>
            )}
            {rule.isComplex && (
              <Badge variant="outline" className="text-xs">
                Komplex
              </Badge>
            )}
            {portDeleted && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Port nicht mehr konfiguriert
              </Badge>
            )}
            {hasElseIf && (
              <Badge variant="secondary" className="text-xs">
                +{rule.elseIfBranches.length} ElseIf
              </Badge>
            )}
            {hasElse && (
              <Badge variant="secondary" className="text-xs">
                +Else
              </Badge>
            )}
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider delayDuration={300}>
              {/* Edit button: hidden for complex or global rules (must use raw-text mode) */}
              {!rule.isComplex && !isGlobal && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(rule)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Bearbeiten</TooltipContent>
                </Tooltip>
              )}
              {/* Duplicate button: available for all non-complex rules */}
              {!rule.isComplex && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onDuplicate(rule)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Duplizieren</TooltipContent>
                </Tooltip>
              )}
              {/* Delete button: always available when not readOnly */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(rule)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Loeschen</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="space-y-1 text-xs font-mono">
          {/* Condition */}
          {rule.additionalCondition && (
            <div className="text-muted-foreground">
              <span className="text-blue-600 dark:text-blue-400">Bedingung: </span>
              {rule.additionalCondition}
            </div>
          )}
          {/* Actions */}
          <div className="text-foreground">
            <span className="text-green-600 dark:text-green-400">Aktion: </span>
            {actionSummary || '(keine Aktion)'}
          </div>
          {/* Complex block: show raw text preview */}
          {rule.isComplex && (
            <div className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
              {rule.rawLines.join('\n')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
