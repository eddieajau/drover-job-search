/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Fact } from 'db'

export interface GapRuleDraft {
  ruleName: string
  ruleCategory: 'regex_title'
  pattern: string
  signalType: 'dealbreaker'
}

const STOPWORDS = new Set(['no', 'professional', 'experience', 'or', 'and'])

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function tokenPattern(token: string): string {
  const escaped = escapeRegExp(token)
  const leading = /^\w/.test(token) ? '\\b' : '(?<!\\w)'
  const trailing = /\w$/.test(token) ? '\\b' : '(?!\\w)'
  return `${leading}${escaped}${trailing}`
}

function tokensFromLabel(label: string): string[] {
  return label
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter(part => {
      if (!/^[a-zA-Z0-9.+#]+$/.test(part)) return false
      if (!/[a-zA-Z]/.test(part)) return false
      return !STOPWORDS.has(part.toLowerCase())
    })
    .map(part => part.toLowerCase())
}

export function rulesFromGapFacts(gapFacts: Fact[], existingRuleNames: string[]): GapRuleDraft[] {
  const existing = new Set(existingRuleNames)
  const drafts: GapRuleDraft[] = []

  for (const fact of gapFacts) {
    const ruleName = `gap-fact-${fact.id}`
    if (existing.has(ruleName)) continue

    const tokens = [...new Set(tokensFromLabel(fact.label))]
    if (tokens.length === 0) continue

    drafts.push({
      ruleName,
      ruleCategory: 'regex_title',
      pattern: `(?i)(?:${tokens.map(tokenPattern).join('|')})`,
      signalType: 'dealbreaker',
    })
  }

  return drafts
}
