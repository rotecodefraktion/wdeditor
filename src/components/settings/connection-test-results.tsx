'use client'

import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import type { ConnectionCheckResult } from '@/lib/settings-schema'

interface ConnectionTestResultsProps {
  results: ConnectionCheckResult[]
}

const statusConfig = {
  pass: {
    icon: CheckCircle,
    className: 'text-green-600 dark:text-green-400',
    bgClassName: 'bg-green-50 dark:bg-green-950/30',
  },
  warn: {
    icon: AlertTriangle,
    className: 'text-yellow-600 dark:text-yellow-400',
    bgClassName: 'bg-yellow-50 dark:bg-yellow-950/30',
  },
  fail: {
    icon: XCircle,
    className: 'text-red-600 dark:text-red-400',
    bgClassName: 'bg-red-50 dark:bg-red-950/30',
  },
}

export function ConnectionTestResults({ results }: ConnectionTestResultsProps) {
  if (results.length === 0) return null

  return (
    <div className="space-y-2" role="list" aria-label="Connection test results">
      {results.map((check) => {
        const config = statusConfig[check.status]
        const Icon = config.icon

        return (
          <div
            key={check.name}
            role="listitem"
            className={`flex items-start gap-3 rounded-md border p-3 ${config.bgClassName}`}
          >
            <Icon
              className={`h-5 w-5 mt-0.5 shrink-0 ${config.className}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{check.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {check.message}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
