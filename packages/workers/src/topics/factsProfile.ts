/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Fact } from 'db'

const CATEGORY_ORDER = ['constraint', 'skill', 'role', 'precedent_story', 'principle', 'gap', 'credential'] as const

type Category = (typeof CATEGORY_ORDER)[number]

const SECTION_TITLES: Record<Category, string> = {
  constraint: 'Constraints',
  skill: 'Skills',
  role: 'Experience',
  precedent_story: 'Proven achievements',
  principle: 'Working principles',
  gap: 'Known gaps',
  credential: 'Credentials',
}

function renderDates(fact: Fact): string | null {
  if (fact.startedAt && fact.endedAt) {
    return `(${fact.startedAt} → ${fact.endedAt})`
  }
  if (fact.startedAt) {
    return `(${fact.startedAt} → present)`
  }
  if (fact.endedAt) {
    return `(${fact.endedAt})`
  }
  return null
}

function renderFactLine(fact: Fact): string {
  let line = fact.label
  if (fact.period) {
    line += ` — ${fact.period}`
  } else {
    const dates = renderDates(fact)
    if (dates) {
      line += ` ${dates}`
    }
  }
  if (fact.detail) {
    line += ` — ${fact.detail}`
  }
  return line
}

export function buildFactsProfile(facts: Fact[]): string {
  const active = facts.filter(f => f.active && f.confidence !== 'stretch')

  const lines = ['Candidate profile (derived from facts):']
  for (const category of CATEGORY_ORDER) {
    const group = active.filter(f => f.category === category)
    if (group.length === 0) {
      continue
    }
    lines.push('')
    lines.push(`## ${SECTION_TITLES[category]}`)
    for (const fact of group) {
      const prefix = fact.confidence === 'inferred' ? '(inferred from resume) ' : ''
      lines.push(`- ${prefix}${renderFactLine(fact)}`)
    }
  }

  if (lines.length === 1) {
    lines.push('No candidate profile recorded.')
  }

  return lines.join('\n')
}
