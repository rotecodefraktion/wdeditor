/**
 * Parser and serializer for SAP Web Dispatcher icm/server_port_* parameters.
 * Used by PROJ-5 Instance Profile Port Editor.
 *
 * Format: icm/server_port_<n> = KEY=VALUE,KEY=VALUE,...
 * Example: icm/server_port_0 = PROT=HTTP,PORT=80,TIMEOUT=60
 */

/** Known SAP Web Dispatcher port parameter keys */
export const KNOWN_PORT_KEYS = [
  'PROT',
  'PORT',
  'TIMEOUT',
  'HOST',
  'VCLIENT',
  'SSLCONFIG',
  'EXTBIND',
  'NOLISTEN',
  'PROCTIMEOUT',
  'KEEPALIVE',
] as const

export type KnownPortKey = (typeof KNOWN_PORT_KEYS)[number]

/** Allowed protocol values */
export const PROTOCOLS = ['HTTP', 'HTTPS', 'SMTP'] as const
export type Protocol = (typeof PROTOCOLS)[number]

/** Represents a single parsed port entry */
export interface PortEntry {
  /** The numeric index from icm/server_port_<n> */
  index: number
  /** Protocol: HTTP, HTTPS, or SMTP */
  prot: Protocol | string
  /** Port number (1-65535) */
  port: number | null
  /** Timeout in seconds */
  timeout: number | null
  /** Optional host binding */
  host: string
  /** VCLIENT for HTTPS (0 or 1) */
  vclient: string
  /** SSL configuration name for HTTPS */
  sslconfig: string
  /** Additional known params not in the structured fields */
  extraParams: Record<string, string>
  /** Unknown parameter keys (for warning display) */
  unknownKeys: string[]
  /** Whether this entry could not be parsed structurally (raw text fallback) */
  rawLine: string | null
  /** Unique key for React rendering */
  id: string
  /** Optional comment text (stored as # line before the port entry in the file) */
  comment?: string
}

/** Result of parsing the entire instance profile */
export interface ParseResult {
  /** Parsed port entries */
  portEntries: PortEntry[]
  /** Lines that are NOT icm/server_port_* (preserved byte-identical) */
  nonPortLines: string[]
  /** All lines with their original indices for reconstruction */
  lineMap: LineMapEntry[]
}

export interface LineMapEntry {
  type: 'port' | 'other' | 'port-comment'
  /** Original line index */
  lineIndex: number
  /** For 'port' / 'port-comment' type: the port entry index */
  portIndex?: number
  /** Original line text */
  originalLine: string
}

/** Regex to match icm/server_port_<n> lines */
const PORT_LINE_REGEX = /^icm\/server_port_(\d+)\s*=\s*(.+)$/

/**
 * Parse an entire instance profile file content.
 * Separates port entries from non-port lines.
 */
export function parseInstanceProfile(content: string): ParseResult {
  const lines = content.split('\n')
  const portEntries: PortEntry[] = []
  const nonPortLines: string[] = []
  const lineMap: LineMapEntry[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(PORT_LINE_REGEX)

    if (match) {
      const index = parseInt(match[1], 10)
      const paramsStr = match[2].trim()
      const entry = parsePortParams(index, paramsStr, line)

      // Check if the immediately preceding line is a # comment line.
      // If so, extract it as the port comment and remove it from nonPortLines/lineMap.
      if (lineMap.length > 0) {
        const prevMapping = lineMap[lineMap.length - 1]
        if (
          prevMapping.type === 'other' &&
          prevMapping.originalLine.trimStart().startsWith('#')
        ) {
          // Extract comment text: strip leading # and whitespace
          const commentText = prevMapping.originalLine
            .trimStart()
            .replace(/^#\s*/, '')
          entry.comment = commentText

          // Remove the comment line from nonPortLines (it was the last one added)
          nonPortLines.pop()

          // Replace the lineMap entry type so it is owned by the port entry
          lineMap[lineMap.length - 1] = {
            type: 'port-comment',
            lineIndex: prevMapping.lineIndex,
            portIndex: index,
            originalLine: prevMapping.originalLine,
          }
        }
      }

      portEntries.push(entry)
      lineMap.push({
        type: 'port',
        lineIndex: i,
        portIndex: index,
        originalLine: line,
      })
    } else {
      nonPortLines.push(line)
      lineMap.push({
        type: 'other',
        lineIndex: i,
        originalLine: line,
      })
    }
  }

  return { portEntries, nonPortLines, lineMap }
}

/**
 * Parse the KEY=VALUE,KEY=VALUE,... portion of a port line.
 */
function parsePortParams(
  index: number,
  paramsStr: string,
  originalLine: string
): PortEntry {
  const entry: PortEntry = {
    index,
    prot: '',
    port: null,
    timeout: null,
    host: '',
    vclient: '',
    sslconfig: '',
    extraParams: {},
    unknownKeys: [],
    rawLine: null,
    id: `port-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }

  // Try to parse KEY=VALUE pairs
  const pairs = paramsStr.split(',').map((p) => p.trim()).filter(Boolean)
  let parseFailed = false

  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=')
    if (eqIndex === -1) {
      // Cannot parse this pair
      parseFailed = true
      break
    }

    const key = pair.slice(0, eqIndex).trim().toUpperCase()
    const value = pair.slice(eqIndex + 1).trim()

    const knownKeySet = new Set<string>(KNOWN_PORT_KEYS)

    switch (key) {
      case 'PROT':
        entry.prot = value.toUpperCase()
        break
      case 'PORT':
        entry.port = parseInt(value, 10)
        if (isNaN(entry.port)) entry.port = null
        break
      case 'TIMEOUT':
        entry.timeout = parseInt(value, 10)
        if (isNaN(entry.timeout)) entry.timeout = null
        break
      case 'HOST':
        entry.host = value
        break
      case 'VCLIENT':
        entry.vclient = value
        break
      case 'SSLCONFIG':
        entry.sslconfig = value
        break
      default:
        if (knownKeySet.has(key)) {
          entry.extraParams[key] = value
        } else {
          entry.unknownKeys.push(key)
          entry.extraParams[key] = value
        }
        break
    }
  }

  if (parseFailed) {
    entry.rawLine = originalLine
  }

  return entry
}

/**
 * Serialize port entries and non-port lines back into file content.
 * Non-port lines are preserved byte-identical in their original positions.
 */
export function serializeInstanceProfile(
  portEntries: PortEntry[],
  nonPortLines: string[],
  lineMap: LineMapEntry[]
): string {
  // Build port entry map by original index for replacement
  const portByIndex = new Map<number, PortEntry>()
  for (const entry of portEntries) {
    portByIndex.set(entry.index, entry)
  }

  // Collect lines that still exist
  const resultLines: string[] = []
  let nonPortIdx = 0

  for (const mapping of lineMap) {
    if (mapping.type === 'other') {
      // Use original non-port line
      if (nonPortIdx < nonPortLines.length) {
        resultLines.push(nonPortLines[nonPortIdx])
        nonPortIdx++
      }
    } else if (mapping.type === 'port-comment' && mapping.portIndex !== undefined) {
      // This was an original comment line for a port.
      // The comment will be written by the 'port' mapping entry below,
      // so we skip it here. If the port was deleted, we also skip the comment.
      continue
    } else if (mapping.type === 'port' && mapping.portIndex !== undefined) {
      const entry = portByIndex.get(mapping.portIndex)
      if (entry) {
        // Write comment line if the entry has a non-empty comment
        const trimmedComment = entry.comment?.trim()
        if (trimmedComment) {
          resultLines.push(`# ${sanitizeValue(trimmedComment)}`)
        }
        resultLines.push(serializePortEntry(entry))
        portByIndex.delete(mapping.portIndex)
      }
      // If entry was deleted, skip this line (and its comment was already skipped)
    }
  }

  // Append any newly added port entries (not in original lineMap)
  for (const entry of portByIndex.values()) {
    const trimmedComment = entry.comment?.trim()
    if (trimmedComment) {
      resultLines.push(`# ${sanitizeValue(trimmedComment)}`)
    }
    resultLines.push(serializePortEntry(entry))
  }

  // Also append remaining non-port lines if any
  while (nonPortIdx < nonPortLines.length) {
    resultLines.push(nonPortLines[nonPortIdx])
    nonPortIdx++
  }

  return resultLines.join('\n')
}

/**
 * Sanitize a value by stripping newlines and null bytes to prevent injection
 * of arbitrary lines into the config file.
 */
function sanitizeValue(val: string): string {
  return val.replace(/[\n\r\0]/g, '')
}

/**
 * Serialize a single port entry back to its icm/server_port_<n> line format.
 */
export function serializePortEntry(entry: PortEntry): string {
  // If this was a raw (unparseable) line, return it as-is
  if (entry.rawLine) {
    return entry.rawLine
  }

  const parts: string[] = []

  if (entry.prot) parts.push(`PROT=${sanitizeValue(entry.prot)}`)
  if (entry.port !== null) parts.push(`PORT=${entry.port}`)
  if (entry.timeout !== null) parts.push(`TIMEOUT=${entry.timeout}`)
  if (entry.host) parts.push(`HOST=${sanitizeValue(entry.host)}`)
  if (entry.prot === 'HTTPS') {
    if (entry.vclient) parts.push(`VCLIENT=${sanitizeValue(entry.vclient)}`)
    if (entry.sslconfig) parts.push(`SSLCONFIG=${sanitizeValue(entry.sslconfig)}`)
  }

  // Add extra known/unknown params
  for (const [key, value] of Object.entries(entry.extraParams)) {
    // Skip keys already handled above
    if (['PROT', 'PORT', 'TIMEOUT', 'HOST', 'VCLIENT', 'SSLCONFIG'].includes(key)) continue
    parts.push(`${sanitizeValue(key)}=${sanitizeValue(value)}`)
  }

  return `icm/server_port_${entry.index} = ${parts.join(',')}`
}

/**
 * Get the next available port index (fills gaps or increments).
 */
export function getNextPortIndex(entries: PortEntry[]): number {
  if (entries.length === 0) return 0
  const usedIndices = new Set(entries.map((e) => e.index))
  let next = 0
  while (usedIndices.has(next)) {
    next++
  }
  return next
}

/**
 * Check if a port number is already used by another entry.
 * excludeIndex: skip the entry with this index (for edit mode).
 */
export function isPortDuplicate(
  entries: PortEntry[],
  portNumber: number,
  excludeIndex?: number
): boolean {
  return entries.some(
    (e) => e.port === portNumber && e.index !== excludeIndex
  )
}

/**
 * Create an empty port entry with defaults.
 */
export function createEmptyPortEntry(index: number): PortEntry {
  return {
    index,
    prot: 'HTTP',
    port: null,
    timeout: 60,
    host: '',
    vclient: '',
    sslconfig: '',
    extraParams: {},
    unknownKeys: [],
    rawLine: null,
    id: `port-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    comment: undefined,
  }
}
