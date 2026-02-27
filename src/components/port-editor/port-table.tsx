'use client'

import { Pencil, Copy, Trash2, Plus, AlertTriangle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslations } from 'next-intl'
import type { PortEntry } from '@/lib/port-parser'

interface PortTableProps {
  entries: PortEntry[]
  readOnly: boolean
  onEdit: (entry: PortEntry) => void
  onDuplicate: (entry: PortEntry) => void
  onDelete: (entry: PortEntry) => void
  onAdd: () => void
}

export function PortTable({
  entries,
  readOnly,
  onEdit,
  onDuplicate,
  onDelete,
  onAdd,
}: PortTableProps) {
  const t = useTranslations('portEditor')
  const tc = useTranslations('common')

  if (entries.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center space-y-4">
        <p className="text-muted-foreground">
          {t('noEntries', { code: 'icm/server_port_*' })}
        </p>
        {!readOnly && (
          <Button onClick={onAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t('addFirstPort')}
          </Button>
        )}
      </div>
    )
  }

  const sortedEntries = [...entries].sort((a, b) => a.index - b.index)

  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">{t('index')}</TableHead>
              <TableHead className="w-24">{t('protocol')}</TableHead>
              <TableHead className="w-24">{t('port')}</TableHead>
              <TableHead className="w-24">{t('timeout')}</TableHead>
              <TableHead>{t('additionalParams')}</TableHead>
              {!readOnly && <TableHead className="w-32 text-right">{t('actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEntries.map((entry) => (
              <PortTableRow
                key={entry.id}
                entry={entry}
                readOnly={readOnly}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      {!readOnly && (
        <Button onClick={onAdd} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t('newPort')}
        </Button>
      )}
    </div>
  )
}

function PortTableRow({
  entry,
  readOnly,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  entry: PortEntry
  readOnly: boolean
  onEdit: (entry: PortEntry) => void
  onDuplicate: (entry: PortEntry) => void
  onDelete: (entry: PortEntry) => void
}) {
  const t = useTranslations('portEditor')
  const tc = useTranslations('common')
  const isRaw = entry.rawLine !== null

  const additionalParams: string[] = []
  if (entry.host) additionalParams.push(`HOST=${entry.host}`)
  if (entry.prot === 'HTTPS') {
    if (entry.vclient) additionalParams.push(`VCLIENT=${entry.vclient}`)
    if (entry.sslconfig) additionalParams.push(`SSLCONFIG=${entry.sslconfig}`)
  }
  for (const [key, value] of Object.entries(entry.extraParams)) {
    if (!['PROT', 'PORT', 'TIMEOUT', 'HOST', 'VCLIENT', 'SSLCONFIG'].includes(key)) {
      additionalParams.push(`${key}=${value}`)
    }
  }

  if (isRaw) {
    return (
      <TableRow className="bg-yellow-50/50 dark:bg-yellow-950/10">
        <TableCell className="font-mono text-sm">{entry.index}</TableCell>
        <TableCell colSpan={readOnly ? 4 : 5}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
            <code className="text-xs text-yellow-800 dark:text-yellow-300 break-all">
              {entry.rawLine}
            </code>
          </div>
          <p className="text-xs text-yellow-600 mt-1">
            {t('unknownFormat')}
          </p>
        </TableCell>
      </TableRow>
    )
  }

  const totalColumns = readOnly ? 5 : 6

  return (
    <>
      <TableRow
        className={!readOnly ? 'cursor-pointer hover:bg-muted/50' : undefined}
        onClick={!readOnly ? () => onEdit(entry) : undefined}
      >
        <TableCell className="font-mono text-sm">{entry.index}</TableCell>
        <TableCell>
          <Badge
            variant={
              entry.prot === 'HTTPS'
                ? 'default'
                : entry.prot === 'HTTP'
                  ? 'secondary'
                  : 'outline'
            }
          >
            {entry.prot}
          </Badge>
        </TableCell>
        <TableCell className="font-mono">{entry.port ?? '--'}</TableCell>
        <TableCell className="text-muted-foreground">
          {entry.timeout !== null ? `${entry.timeout}s` : '--'}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {additionalParams.map((param) => (
              <span
                key={param}
                className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono"
              >
                {param}
              </span>
            ))}
            {entry.unknownKeys.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-400">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {t('unknownParamsBadge', { count: entry.unknownKeys.length })}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('unknownParams', { keys: entry.unknownKeys.join(', ') })}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </TableCell>
        {!readOnly && (
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); onEdit(entry) }}
                      aria-label={`${tc('edit')} Port ${entry.port}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{tc('edit')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); onDuplicate(entry) }}
                      aria-label={`${tc('duplicate')} Port ${entry.port}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{tc('duplicate')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); onDelete(entry) }}
                      aria-label={`${tc('delete')} Port ${entry.port}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{tc('delete')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </TableCell>
        )}
      </TableRow>
      {entry.comment && (
        <TableRow
          className={`border-t-0 ${!readOnly ? 'cursor-pointer hover:bg-muted/50' : ''}`}
          onClick={!readOnly ? () => onEdit(entry) : undefined}
        >
          <TableCell colSpan={totalColumns} className="pt-0 pb-2 pl-6">
            <p className="text-xs text-muted-foreground italic truncate max-w-full" title={entry.comment}>
              # {entry.comment}
            </p>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
