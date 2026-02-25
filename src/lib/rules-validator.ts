/**
 * Client-side validation for SAP Web Dispatcher rules.txt syntax.
 * Used by PROJ-6 for inline feedback in the rule form.
 */

import { KNOWN_DIRECTIVES, KNOWN_VARIABLES } from './rules-parser'

export type ValidationSeverity = 'ok' | 'warning' | 'error'

export interface ValidationFeedback {
  severity: ValidationSeverity
  message: string
}

/** Set of known directives (case-insensitive lookup) */
const DIRECTIVE_SET = new Set(
  KNOWN_DIRECTIVES.map((d) => d.toLowerCase())
)

/** Set of known variable patterns */
const VARIABLE_SET = new Set(
  KNOWN_VARIABLES.map((v) => v.toLowerCase())
)

/**
 * Validate a directive name.
 */
export function validateDirective(directive: string): ValidationFeedback {
  if (!directive.trim()) {
    return { severity: 'error', message: 'Direktive ist erforderlich' }
  }

  if (DIRECTIVE_SET.has(directive.trim().toLowerCase())) {
    return { severity: 'ok', message: 'Bekannte Direktive' }
  }

  return {
    severity: 'warning',
    message: `Unbekannte Direktive "${directive}" – bitte pruefen`,
  }
}

/**
 * Validate a condition string for known/unknown variables.
 * Returns feedback for each variable found.
 */
export function validateCondition(condition: string): ValidationFeedback[] {
  if (!condition.trim()) return []

  const feedback: ValidationFeedback[] = []
  // Match %{VARIABLE_NAME} patterns
  const varPattern = /%\{([^}]+)\}/g
  let match

  while ((match = varPattern.exec(condition)) !== null) {
    const fullVar = `%{${match[1]}}`
    const varLower = fullVar.toLowerCase()

    // Check known variables (including %{HTTP_*} pattern)
    if (VARIABLE_SET.has(varLower)) {
      feedback.push({ severity: 'ok', message: `${fullVar}: Bekannte Variable` })
    } else if (match[1].toUpperCase().startsWith('HTTP_')) {
      // %{HTTP_<header>} is a valid pattern
      feedback.push({ severity: 'ok', message: `${fullVar}: HTTP-Header Variable` })
    } else {
      feedback.push({
        severity: 'warning',
        message: `${fullVar}: Unbekannte Variable – bitte pruefen`,
      })
    }
  }

  return feedback
}

/**
 * Validate the full text of rules.txt for structural issues.
 * Returns an array of warnings/errors.
 */
export function validateRulesText(content: string): ValidationFeedback[] {
  const lines = content.split('\n')
  const feedback: ValidationFeedback[] = []
  let ifDepth = 0

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (/^If\s+/i.test(trimmed)) {
      ifDepth++
    } else if (/^End\s*$/i.test(trimmed)) {
      ifDepth--
      if (ifDepth < 0) {
        feedback.push({
          severity: 'error',
          message: `Zeile ${i + 1}: "End" ohne passendes "If"`,
        })
        ifDepth = 0
      }
    }
  }

  if (ifDepth > 0) {
    feedback.push({
      severity: 'error',
      message: `${ifDepth} "If"-Block(s) ohne "End" – bitte alle Bloecke schliessen`,
    })
  }

  return feedback
}
