/**
 * Rules integrity checker for PROJ-5 Port Editor.
 * Scans rules.txt content for references to a specific port number.
 *
 * Pattern: %{SERVER_PORT} = <port>
 * This is the standard condition pattern in SAP Web Dispatcher rewrite rules.
 */

export interface RulesIntegrityResult {
  /** Number of rules referencing this port */
  matchCount: number
  /** Matched rule descriptions (comment/name lines above matching rules) */
  matchedRules: string[]
}

/**
 * Scan rules.txt content for rules that reference a specific port.
 * Looks for patterns like: %{SERVER_PORT} = <port>
 *
 * Also extracts the comment/name line preceding each match for display.
 */
export function checkPortInRules(
  rulesContent: string,
  port: number
): RulesIntegrityResult {
  if (!rulesContent.trim()) {
    return { matchCount: 0, matchedRules: [] }
  }

  const lines = rulesContent.split('\n')
  const matchedRules: string[] = []

  // Pattern: %{SERVER_PORT} = <port> (with optional whitespace)
  const portPattern = new RegExp(
    `%\\{SERVER_PORT\\}\\s*=\\s*${port}(?:\\s|$|,|\\))`,
    'i'
  )

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (portPattern.test(line)) {
      // Try to find the rule name/comment above this line
      let ruleName = `Zeile ${i + 1}: ${line.trim().slice(0, 80)}`

      // Look back for a comment line that describes this rule
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prevLine = lines[j].trim()
        if (prevLine.startsWith('#')) {
          ruleName = prevLine.replace(/^#+\s*/, '').trim()
          break
        }
        // Stop looking if we hit a non-empty, non-comment line
        if (prevLine && !prevLine.startsWith('#')) break
      }

      matchedRules.push(ruleName)
    }
  }

  return {
    matchCount: matchedRules.length,
    matchedRules,
  }
}
