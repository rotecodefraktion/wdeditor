'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { diffLines } from 'diff'
import { ScrollArea } from '@/components/ui/scroll-area'

interface DiffViewerProps {
  original: string
  modified: string
  fileName?: string
}

export function DiffViewer({ original, modified, fileName }: DiffViewerProps) {
  const tc = useTranslations('common')
  const changes = useMemo(() => diffLines(original, modified), [original, modified])

  const hasChanges = changes.some((c) => c.added || c.removed)

  if (!hasChanges) {
    return (
      <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
        {tc('noChanges')}
      </div>
    )
  }

  // Build line-numbered diff output
  const lines: { type: 'added' | 'removed' | 'unchanged'; text: string }[] = []
  for (const change of changes) {
    const changeLines = change.value.replace(/\n$/, '').split('\n')
    for (const line of changeLines) {
      if (change.added) {
        lines.push({ type: 'added', text: line })
      } else if (change.removed) {
        lines.push({ type: 'removed', text: line })
      } else {
        lines.push({ type: 'unchanged', text: line })
      }
    }
  }

  return (
    <div className="rounded-md border overflow-hidden">
      {fileName && (
        <div className="border-b bg-muted px-3 py-1.5 text-xs font-mono text-muted-foreground">
          {fileName}
        </div>
      )}
      <ScrollArea className="max-h-[400px]">
        <div className="font-mono text-xs leading-5">
          {lines.map((line, i) => (
            <div
              key={i}
              className={
                line.type === 'added'
                  ? 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300'
                  : line.type === 'removed'
                    ? 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                    : 'text-foreground'
              }
            >
              <span className="inline-block w-6 text-right text-muted-foreground select-none pr-1">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <span className="pl-1">{line.text || ' '}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
