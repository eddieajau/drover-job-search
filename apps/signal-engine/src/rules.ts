/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobSignals, jobs, signalRules, type DB, type SignalRule } from 'db'
import { eq } from 'drizzle-orm'
import type { Logger } from 'pino'

const CATEGORY_FIELD: Record<SignalRule['ruleCategory'], 'title' | 'companyName' | 'description'> = {
  regex_title: 'title',
  regex_company: 'companyName',
  regex_description: 'description',
}

const SIGNAL_TYPE: Record<SignalRule['ruleCategory'], string> = {
  regex_title: 'skill_match',
  regex_company: 'company_match',
  regex_description: 'skill_match',
}

function compilePattern(pattern: string, baseFlags = 'g'): RegExp {
  let flags = baseFlags
  let source = pattern
  const inlineFlagMatch = source.match(/^\(\?([gimsuy]+)\)/)
  if (inlineFlagMatch) {
    for (const flag of inlineFlagMatch[1]) {
      if (!flags.includes(flag)) flags += flag
    }
    source = source.slice(inlineFlagMatch[0].length)
  }
  return new RegExp(source, flags)
}

export function matches(pattern: string, text: string): string[] {
  const re = compilePattern(pattern)
  const keywords: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[0].length > 0) keywords.push(m[0])
    if (re.lastIndex === m.index) re.lastIndex++
  }
  return keywords
}

export function recomputeRule(db: DB, rule: SignalRule, log?: Logger): number {
  let compiled: RegExp
  try {
    compiled = compilePattern(rule.pattern)
  } catch (err) {
    log?.error({ ruleName: rule.ruleName, pattern: rule.pattern, err }, 'invalid regex; skipping rule')
    return 0
  }

  db.delete(jobSignals).where(eq(jobSignals.ruleId, rule.id)).run()

  const field = CATEGORY_FIELD[rule.ruleCategory]
  const rows = db.select().from(jobs).all()
  let matched = 0

  for (const row of rows) {
    const text = row[field]
    if (text == null) continue

    const keywords: string[] = []
    let m: RegExpExecArray | null
    compiled.lastIndex = 0
    while ((m = compiled.exec(text)) !== null) {
      if (m[0].length > 0) keywords.push(m[0])
      if (compiled.lastIndex === m.index) compiled.lastIndex++
    }
    if (keywords.length === 0) continue

    db.insert(jobSignals)
      .values({
        jobId: row.id,
        ruleId: rule.id,
        source: rule.ruleCategory,
        signalType: SIGNAL_TYPE[rule.ruleCategory],
        score: rule.scoreModifier,
        metadata: JSON.stringify({ matched_keywords: keywords }),
      })
      .run()
    matched++
  }
  return matched
}

export function runEnabledRules(db: DB, log?: Logger): Record<string, number> {
  const rules = db.select().from(signalRules).where(eq(signalRules.enabled, true)).all()
  const summary: Record<string, number> = {}
  for (const rule of rules) {
    summary[rule.ruleName] = recomputeRule(db, rule, log)
  }
  return summary
}
