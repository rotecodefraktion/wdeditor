'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { RuleCard } from './rule-card'
import type { RuleBlock } from '@/lib/rules-parser'

interface PortSectionProps {
  /** Port number */
  port: number
  /** Protocol name (e.g. "HTTP", "HTTPS") */
  protocol: string
  /** Rules for this port */
  rules: RuleBlock[]
  /** Whether editing is disabled */
  readOnly: boolean
  /** Ports that are no longer configured */
  deletedPorts: Set<number>
  onAddRule: (port: number) => void
  onEditRule: (rule: RuleBlock) => void
  onDuplicateRule: (rule: RuleBlock) => void
  onDeleteRule: (rule: RuleBlock) => void
}

export function PortSection({
  port,
  protocol,
  rules,
  readOnly,
  deletedPorts,
  onAddRule,
  onEditRule,
  onDuplicateRule,
  onDeleteRule,
}: PortSectionProps) {
  const [isOpen, setIsOpen] = useState(true)
  const isPortDeleted = deletedPorts.has(port)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg">
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
              <span className="font-medium text-sm">
                {protocol} &middot; {port}
              </span>
              <Badge variant="secondary" className="text-xs">
                {rules.length} {rules.length === 1 ? 'Regel' : 'Regeln'}
              </Badge>
              {isPortDeleted && (
                <Badge variant="destructive" className="text-xs">
                  Port geloescht
                </Badge>
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {rules.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Keine Regeln fuer diesen Port.{' '}
                {!readOnly && !isPortDeleted && 'Fuege die erste Regel hinzu.'}
              </p>
            )}

            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                readOnly={readOnly}
                portDeleted={isPortDeleted}
                onEdit={onEditRule}
                onDuplicate={onDuplicateRule}
                onDelete={onDeleteRule}
              />
            ))}

            {!readOnly && !isPortDeleted && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => onAddRule(port)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Neue Regel fuer Port {port}
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
