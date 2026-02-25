'use client'

import { useState } from 'react'
import { Globe, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { RuleCard } from './rule-card'
import type { RuleBlock } from '@/lib/rules-parser'

interface GlobalRulesSectionProps {
  rules: RuleBlock[]
  readOnly: boolean
  onEditRule: (rule: RuleBlock) => void
  onDuplicateRule: (rule: RuleBlock) => void
  onDeleteRule: (rule: RuleBlock) => void
}

export function GlobalRulesSection({
  rules,
  readOnly,
  onEditRule,
  onDuplicateRule,
  onDeleteRule,
}: GlobalRulesSectionProps) {
  const [isOpen, setIsOpen] = useState(true)

  if (rules.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg border-dashed">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  isOpen ? '' : '-rotate-90'
                }`}
              />
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">
                Globale Regeln (nicht port-scoped)
              </span>
              <Badge variant="outline" className="text-xs">
                {rules.length} {rules.length === 1 ? 'Regel' : 'Regeln'}
              </Badge>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            <Alert className="mb-3">
              <AlertDescription className="text-xs">
                Globale Regeln ohne <code>%{'{'}{`SERVER_PORT`}{'}'}</code>-Bedingung. Diese sind nur im Raw-Text-Modus bearbeitbar.
              </AlertDescription>
            </Alert>

            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                readOnly={readOnly}
                isGlobal
                onEdit={onEditRule}
                onDuplicate={onDuplicateRule}
                onDelete={onDeleteRule}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
