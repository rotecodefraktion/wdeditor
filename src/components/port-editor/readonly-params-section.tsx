'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText } from 'lucide-react'

interface ReadonlyParamsSectionProps {
  /** Non-port lines from the instance profile */
  lines: string[]
}

export function ReadonlyParamsSection({ lines }: ReadonlyParamsSectionProps) {
  // Filter out completely empty lines at the end
  const displayLines = lines.filter((line, index) => {
    // Keep the line if it has content, or if it's not a trailing empty line
    if (line.trim()) return true
    // Check if there are any non-empty lines after this one
    return lines.slice(index + 1).some((l) => l.trim())
  })

  if (displayLines.length === 0) {
    return null
  }

  const nonEmptyCount = displayLines.filter((l) => l.trim()).length

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="readonly-params" className="border rounded-md px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>Weitere Parameter</span>
            <span className="text-xs text-muted-foreground">
              ({nonEmptyCount} Zeile{nonEmptyCount !== 1 ? 'n' : ''} -- nur lesen)
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <ScrollArea className="max-h-[400px]">
            <pre className="font-mono text-xs leading-5 bg-muted/50 rounded-md p-3 whitespace-pre-wrap break-all">
              {displayLines.join('\n')}
            </pre>
          </ScrollArea>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
