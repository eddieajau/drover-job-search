import { createDb, jobSignals, jobs, signalRules } from 'db'
import { describe, it, expect } from 'vitest'

import { matches, recomputeRule, runEnabledRules } from './rules.js'

function seed(db: ReturnType<typeof createDb>) {
  db.insert(jobs)
    .values([
      {
        provider: 'linkedin',
        providerJobId: 'job-1',
        title: 'Senior Java Developer',
        companyName: 'Acme Corp',
        url: 'https://example.com/1',
        location: 'Remote',
      },
      {
        provider: 'linkedin',
        providerJobId: 'job-2',
        title: 'Frontend Engineer',
        companyName: 'Beta Inc',
        url: 'https://example.com/2',
        location: 'Remote',
      },
      {
        provider: 'linkedin',
        providerJobId: 'job-3',
        title: 'Android Developer',
        companyName: 'Gamma LLC',
        url: 'https://example.com/3',
        location: 'Remote',
        description: 'Build Android apps with Java and Kotlin',
      },
    ])
    .run()
}

describe('matches', () => {
  it('returns matched keywords', () => {
    expect(matches('(?i)\\b(java|android)\\b', 'Senior Java Developer')).toEqual(['Java'])
    expect(matches('(?i)\\b(java|android)\\b', 'Android and Java roles')).toEqual(['Android', 'Java'])
    expect(matches('(?i)\\b(java|android)\\b', 'No match here')).toEqual([])
  })
})

describe('recomputeRule', () => {
  it('seeds jobs + rules and asserts correct signal rows and metadata', () => {
    const db = createDb(':memory:')
    seed(db)
    db.insert(signalRules)
      .values({
        ruleName: 'java-android',
        ruleCategory: 'regex_title',
        pattern: '(?i)\\b(java|android)\\b',
        scoreModifier: 10,
      })
      .run()
    const rule = db.select().from(signalRules).get()!

    const matched = recomputeRule(db, rule)

    expect(matched).toBe(2)
    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(2)
    expect(signals.map(s => s.jobId).sort()).toEqual([1, 3])
    for (const s of signals) {
      expect(s.source).toBe('regex_title')
      expect(s.signalType).toBe('skill_match')
      expect(s.score).toBe(10)
      expect(s.ruleId).toBe(rule.id)
      const meta = JSON.parse(s.metadata!)
      expect(meta.matched_keywords).toBeDefined()
      expect(Array.isArray(meta.matched_keywords)).toBe(true)
    }
    db.$client.close()
  })

  it('re-run is idempotent (no duplicate rows)', () => {
    const db = createDb(':memory:')
    seed(db)
    db.insert(signalRules)
      .values({
        ruleName: 'java-android',
        ruleCategory: 'regex_title',
        pattern: '(?i)\\b(java|android)\\b',
        scoreModifier: 10,
      })
      .run()
    const rule = db.select().from(signalRules).get()!

    recomputeRule(db, rule)
    recomputeRule(db, rule)

    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(2)
    db.$client.close()
  })

  it('invalid regex does not throw', () => {
    const db = createDb(':memory:')
    seed(db)
    db.insert(signalRules)
      .values({
        ruleName: 'bad-pattern',
        ruleCategory: 'regex_title',
        pattern: '(unclosed',
        scoreModifier: 5,
      })
      .run()
    const rule = db.select().from(signalRules).get()!

    expect(() => recomputeRule(db, rule)).not.toThrow()

    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(0)
    db.$client.close()
  })

  it('editing a rule pattern regenerates signals for that rule only', () => {
    const db = createDb(':memory:')
    seed(db)
    db.insert(signalRules)
      .values([
        {
          ruleName: 'title-rule',
          ruleCategory: 'regex_title',
          pattern: '(?i)\\bjava\\b',
          scoreModifier: 10,
        },
        {
          ruleName: 'company-rule',
          ruleCategory: 'regex_company',
          pattern: '(?i)\\bacme\\b',
          scoreModifier: 5,
        },
      ])
      .run()
    const [titleRule, companyRule] = db.select().from(signalRules).all()

    recomputeRule(db, titleRule)
    recomputeRule(db, companyRule)
    expect(db.select().from(jobSignals).all()).toHaveLength(2)

    db.$client.prepare("UPDATE signal_rules SET pattern = '(?i)\\\\bpython\\\\b' WHERE id = ?").run(titleRule.id)
    const updated = db
      .select()
      .from(signalRules)
      .where()
      .all()
      .find(r => r.id === titleRule.id)!

    const matched = recomputeRule(db, updated)
    expect(matched).toBe(0)

    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(1)
    expect(signals[0].ruleId).toBe(companyRule.id)
    db.$client.close()
  })
})

describe('runEnabledRules', () => {
  it('skips disabled rules', () => {
    const db = createDb(':memory:')
    seed(db)
    db.insert(signalRules)
      .values([
        {
          ruleName: 'enabled-rule',
          ruleCategory: 'regex_title',
          pattern: '(?i)\\bjava\\b',
          scoreModifier: 10,
          enabled: true,
        },
        {
          ruleName: 'disabled-rule',
          ruleCategory: 'regex_title',
          pattern: '(?i)\\bjava\\b',
          scoreModifier: 5,
          enabled: false,
        },
      ])
      .run()

    const summary = runEnabledRules(db)

    expect(Object.keys(summary)).toEqual(['enabled-rule'])
    expect(summary['enabled-rule']).toBe(1)
    expect(summary['disabled-rule']).toBeUndefined()

    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(1)
    expect(signals[0].score).toBe(10)
    db.$client.close()
  })
})
