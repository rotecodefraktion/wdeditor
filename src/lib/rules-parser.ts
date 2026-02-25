/**
 * Parser and serializer for SAP Web Dispatcher rules.txt.
 * Used by PROJ-6 Rules.txt Rewrite Rule Editor.
 *
 * Parses If/ElseIf/Else/End blocks, extracts %{SERVER_PORT} scoping,
 * and groups rules by port. Supports round-trip (parse → edit → serialize).
 */

/** Known SAP Web Dispatcher rule directives */
export const KNOWN_DIRECTIVES = [
  'If', 'ElseIf', 'Else', 'End',
  'Forward', 'Redirect', 'Rewrite', 'Deny',
  'SetHeader', 'RemoveHeader', 'SetEnvIf', 'Pass',
] as const

export type Directive = (typeof KNOWN_DIRECTIVES)[number]

/** Known SAP Web Dispatcher condition variables */
export const KNOWN_VARIABLES = [
  '%{PATH}', '%{HOST}', '%{METHOD}', '%{QUERY}',
  '%{URL}', '%{SERVER_PORT}', '%{REMOTE_ADDR}',
] as const

/** Action types for the structured form */
export const ACTION_TYPES = [
  'Forward', 'Redirect', 'Rewrite', 'Deny',
  'SetHeader', 'RemoveHeader', 'SetEnvIf', 'Pass',
] as const

export type ActionType = (typeof ACTION_TYPES)[number]

/** A single action line inside an If/ElseIf/Else block */
export interface RuleAction {
  directive: ActionType | string
  params: string
}

/** An ElseIf branch */
export interface ElseIfBranch {
  condition: string
  actions: RuleAction[]
}

/** A fully parsed rule block (one If...End block) */
export interface RuleBlock {
  /** Unique ID for React keys */
  id: string
  /** Comment/name line above the If block (without #) */
  comment: string
  /** Port number from %{SERVER_PORT} = <n>, null if global */
  port: number | null
  /** Additional condition after the port condition */
  additionalCondition: string
  /** Primary actions in the If block */
  actions: RuleAction[]
  /** ElseIf branches */
  elseIfBranches: ElseIfBranch[]
  /** Else actions */
  elseActions: RuleAction[]
  /** Whether this block has structures too complex for the form */
  isComplex: boolean
  /** Whether this rule has no %{SERVER_PORT} scope */
  isGlobal: boolean
  /** Original raw text lines (for serialization of complex blocks) */
  rawLines: string[]
  /** Start line index in original file */
  startLine: number
  /** End line index in original file (inclusive) */
  endLine: number
  /** Interstitial lines (blanks, standalone comments) that appeared before this rule but after the previous rule */
  leadingLines?: string[]
}

/** Result of parsing the entire rules.txt */
export interface RulesParseResult {
  /** Parsed rule blocks */
  rules: RuleBlock[]
  /** Standalone lines not part of any If..End block (comments, blank lines at top/between blocks) */
  preambleLines: string[]
  /** Lines after the last rule block (trailing comments, blank lines) */
  trailingLines: string[]
  /** Any parse warnings */
  warnings: string[]
}

let idCounter = 0

function generateId(): string {
  return `rule-${Date.now()}-${++idCounter}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Parse rules.txt content into structured RuleBlock array.
 */
export function parseRules(content: string): RulesParseResult {
  const lines = content.split('\n')
  const rules: RuleBlock[] = []
  const preambleLines: string[] = []
  const warnings: string[] = []

  // Collect interstitial lines between rules; lines before the first rule go to preambleLines,
  // lines between rules get attached as leadingLines on the next rule.
  let pendingInterstitial: string[] = []
  let foundFirstRule = false

  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Check if this line starts an If block
    if (/^If\s+/i.test(trimmed)) {
      // Look back for comment line(s) directly above
      let comment = ''

      // Check if the line directly before is a comment (last pending interstitial)
      if (pendingInterstitial.length > 0) {
        const lastPending = pendingInterstitial[pendingInterstitial.length - 1].trim()
        if (lastPending.startsWith('#')) {
          comment = lastPending.replace(/^#+\s*/, '').trim()
          pendingInterstitial.pop()
        }
      }

      // Find the matching End
      const blockStartLine = comment ? i - 1 : i
      const blockLines: string[] = comment ? [lines[i - 1]] : []
      blockLines.push(line)
      let depth = 1
      let j = i + 1

      while (j < lines.length && depth > 0) {
        const innerTrimmed = lines[j].trim()
        blockLines.push(lines[j])

        if (/^If\s+/i.test(innerTrimmed)) {
          depth++
        } else if (/^End\s*$/i.test(innerTrimmed)) {
          depth--
        }
        j++
      }

      if (depth !== 0) {
        warnings.push(`Zeile ${i + 1}: If-Block ohne passendes End`)
      }

      const block = parseIfBlock(blockLines, comment, blockStartLine, j - 1, depth !== 0)

      // Attach pending interstitial lines
      if (!foundFirstRule) {
        // Lines before the first rule go to preambleLines
        preambleLines.push(...pendingInterstitial)
        foundFirstRule = true
      } else {
        // Lines between rules get attached to this rule
        block.leadingLines = [...pendingInterstitial]
      }
      pendingInterstitial = []

      rules.push(block)
      i = j
    } else {
      // Not an If line — collect as pending interstitial
      pendingInterstitial.push(line)
      i++
    }
  }

  // Any trailing interstitial lines after the last rule go to trailingLines
  // (or if there were no rules at all, everything goes to preambleLines)
  const trailingLines: string[] = []
  if (!foundFirstRule) {
    preambleLines.push(...pendingInterstitial)
  } else if (pendingInterstitial.length > 0) {
    trailingLines.push(...pendingInterstitial)
  }

  return { rules, preambleLines, trailingLines, warnings }
}

/**
 * Parse a single If...End block into a RuleBlock.
 */
function parseIfBlock(
  blockLines: string[],
  comment: string,
  startLine: number,
  endLine: number,
  hasMissingEnd: boolean
): RuleBlock {
  const block: RuleBlock = {
    id: generateId(),
    comment,
    port: null,
    additionalCondition: '',
    actions: [],
    elseIfBranches: [],
    elseActions: [],
    isComplex: false,
    isGlobal: true,
    rawLines: [...blockLines],
    startLine,
    endLine,
  }

  if (hasMissingEnd) {
    block.isComplex = true
    return block
  }

  // Filter out comment line from parsing
  const codeLines = comment
    ? blockLines.slice(1)
    : blockLines

  // Parse the If condition
  const ifLine = codeLines[0]?.trim() || ''
  const conditionMatch = ifLine.match(/^If\s+(.+)$/i)
  if (!conditionMatch) {
    block.isComplex = true
    return block
  }

  const fullCondition = conditionMatch[1].trim()

  // Extract %{SERVER_PORT} = <n>
  const portMatch = fullCondition.match(/%\{SERVER_PORT\}\s*=\s*(\d+)/)
  if (portMatch) {
    block.port = parseInt(portMatch[1], 10)
    block.isGlobal = false

    // Extract additional condition (everything after the port condition)
    let remaining = fullCondition.replace(/%\{SERVER_PORT\}\s*=\s*\d+/, '').trim()
    // Remove leading && if present
    remaining = remaining.replace(/^&&\s*/, '').trim()
    block.additionalCondition = remaining
  } else {
    block.additionalCondition = fullCondition
  }

  // Check for nested If blocks (makes it complex)
  let nestedIfCount = 0
  for (let k = 1; k < codeLines.length; k++) {
    if (/^\s*If\s+/i.test(codeLines[k])) {
      nestedIfCount++
    }
  }
  if (nestedIfCount > 0) {
    block.isComplex = true
    return block
  }

  // Parse body: actions, ElseIf, Else
  type ParseState = 'if-body' | 'elseif-body' | 'else-body'
  let state: ParseState = 'if-body'
  let currentElseIf: ElseIfBranch | null = null

  for (let k = 1; k < codeLines.length; k++) {
    const lineTrimmed = codeLines[k].trim()

    if (/^End\s*$/i.test(lineTrimmed)) {
      // End of block
      if (currentElseIf) {
        block.elseIfBranches.push(currentElseIf)
        currentElseIf = null
      }
      break
    }

    if (/^ElseIf\s+/i.test(lineTrimmed)) {
      // Save current elseIf if any
      if (currentElseIf) {
        block.elseIfBranches.push(currentElseIf)
      }
      const elseIfMatch = lineTrimmed.match(/^ElseIf\s+(.+)$/i)
      currentElseIf = {
        condition: elseIfMatch ? elseIfMatch[1].trim() : '',
        actions: [],
      }
      state = 'elseif-body'
      continue
    }

    if (/^Else\s*$/i.test(lineTrimmed)) {
      if (currentElseIf) {
        block.elseIfBranches.push(currentElseIf)
        currentElseIf = null
      }
      state = 'else-body'
      continue
    }

    // Skip blank lines and comments inside the block
    if (!lineTrimmed || lineTrimmed.startsWith('#')) continue

    // Parse as action
    const action = parseAction(lineTrimmed)
    if (action) {
      switch (state) {
        case 'if-body':
          block.actions.push(action)
          break
        case 'elseif-body':
          currentElseIf?.actions.push(action)
          break
        case 'else-body':
          block.elseActions.push(action)
          break
      }
    } else {
      // Unrecognized line inside block
      block.isComplex = true
    }
  }

  return block
}

/**
 * Parse a single action line (e.g. "Forward https://backend:8443/app/$1")
 */
function parseAction(line: string): RuleAction | null {
  // Match: Directive followed by optional params
  const match = line.match(/^(\w+)\s*(.*)$/)
  if (!match) return null

  return {
    directive: match[1],
    params: match[2].trim(),
  }
}

/**
 * Sanitize a value by stripping newlines and null bytes to prevent injection
 * of arbitrary lines into the config file.
 */
function sanitizeValue(val: string): string {
  return val.replace(/[\n\r\0]/g, '')
}

/**
 * Serialize a RuleBlock back to text lines.
 */
export function serializeRule(rule: RuleBlock): string {
  // Complex blocks: prepend leadingLines before rawLines
  if (rule.isComplex) {
    const parts: string[] = []
    if (rule.leadingLines && rule.leadingLines.length > 0) {
      parts.push(...rule.leadingLines)
    }
    parts.push(...rule.rawLines)
    return parts.join('\n')
  }

  const lines: string[] = []

  // Leading lines (interstitial blank/comment lines before this rule)
  if (rule.leadingLines && rule.leadingLines.length > 0) {
    for (const ll of rule.leadingLines) {
      lines.push(ll)
    }
  }

  // Comment line
  if (rule.comment) {
    lines.push(`# ${sanitizeValue(rule.comment)}`)
  }

  // Build the If condition
  let condition = ''
  if (rule.port !== null) {
    condition = `%{SERVER_PORT} = ${rule.port}`
    if (rule.additionalCondition) {
      condition += ` && ${sanitizeValue(rule.additionalCondition)}`
    }
  } else {
    condition = sanitizeValue(rule.additionalCondition) || 'true'
  }
  lines.push(`If ${condition}`)

  // Primary actions
  for (const action of rule.actions) {
    const params = action.params ? ' ' + sanitizeValue(action.params) : ''
    lines.push(`  ${sanitizeValue(action.directive)}${params}`)
  }

  // ElseIf branches
  for (const branch of rule.elseIfBranches) {
    lines.push(`ElseIf ${sanitizeValue(branch.condition)}`)
    for (const action of branch.actions) {
      const params = action.params ? ' ' + sanitizeValue(action.params) : ''
      lines.push(`  ${sanitizeValue(action.directive)}${params}`)
    }
  }

  // Else block
  if (rule.elseActions.length > 0) {
    lines.push('Else')
    for (const action of rule.elseActions) {
      const params = action.params ? ' ' + sanitizeValue(action.params) : ''
      lines.push(`  ${sanitizeValue(action.directive)}${params}`)
    }
  }

  lines.push('End')
  return lines.join('\n')
}

/**
 * Serialize the entire parsed result back to file content.
 */
export function serializeRules(
  rules: RuleBlock[],
  preambleLines: string[],
  trailingLines: string[] = []
): string {
  const parts: string[] = []

  if (rules.length === 0) {
    // No rules at all — return preamble + trailing
    const allLines = [...preambleLines, ...trailingLines]
    return allLines.join('\n')
  }

  // Add preamble lines at top (lines before the first rule)
  if (preambleLines.length > 0) {
    parts.push(preambleLines.join('\n'))
  }

  // Add each rule (leadingLines provide spacing between rules)
  for (let idx = 0; idx < rules.length; idx++) {
    const rule = rules[idx]
    const serialized = serializeRule(rule)

    if (rule.leadingLines && rule.leadingLines.length > 0) {
      // leadingLines already included in serializeRule output
      parts.push(serialized)
    } else if (idx > 0 || parts.length > 0) {
      // Default: add a blank line separator between rules (and after preamble)
      parts.push('\n' + serialized)
    } else {
      parts.push(serialized)
    }
  }

  // Add trailing lines after the last rule
  if (trailingLines.length > 0) {
    parts.push(trailingLines.join('\n'))
  }

  return parts.join('\n')
}

/**
 * Create a new empty rule for a given port.
 */
export function createEmptyRule(port: number): RuleBlock {
  return {
    id: generateId(),
    comment: '',
    port,
    additionalCondition: '',
    actions: [{ directive: 'Forward', params: '' }],
    elseIfBranches: [],
    elseActions: [],
    isComplex: false,
    isGlobal: false,
    rawLines: [],
    startLine: -1,
    endLine: -1,
    leadingLines: [],
  }
}

/**
 * Group rules by their port number.
 * Returns a Map with port number as key and array of rules as value.
 * Global rules (port === null) are grouped under key -1.
 */
export function groupRulesByPort(rules: RuleBlock[]): Map<number, RuleBlock[]> {
  const groups = new Map<number, RuleBlock[]>()

  for (const rule of rules) {
    const key = rule.port ?? -1
    const existing = groups.get(key) || []
    existing.push(rule)
    groups.set(key, existing)
  }

  return groups
}
