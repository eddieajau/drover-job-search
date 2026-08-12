import { createDb, jobSignals, jobs, signalRules } from 'db'
import { eq } from 'drizzle-orm'
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
        description: '- Build **Android** apps with [Java](https://example.com) and Kotlin\n- Ship to production',
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

  it('word boundaries match inside markdown emphasis and link text', () => {
    expect(
      matches('(?i)\\b(java|android)\\b', '- Build **Android** apps with [Java](https://example.com) and Kotlin')
    ).toEqual(['Android', 'Java'])
  })

  it('markdown list-item rule matches sibling list items independently', () => {
    expect(
      matches(
        '(?m)^\\- (.+)$',
        '- Build **Android** apps with [Java](https://example.com) and Kotlin\n- Ship to production'
      )
    ).toEqual(['- Build **Android** apps with [Java](https://example.com) and Kotlin', '- Ship to production'])
  })

  it('does not match a keyword buried mid-word in a markdown link URL', () => {
    expect(matches('(?i)\\bjava\\b', '[Senior Java Engineer](https://example.com/javacareers)')).toEqual(['Java'])
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
      expect(s.score).toBe(0)
      expect(s.ruleId).toBe(rule.id)
      const meta = JSON.parse(s.metadata!)
      expect(meta.matched_keywords).toBeDefined()
      expect(Array.isArray(meta.matched_keywords)).toBe(true)
    }
    db.$client.close()
  })

  it('fires the rule-declared signal_type (dealbreaker) on matched jobs', () => {
    const db = createDb(':memory:')
    seed(db)
    db.insert(signalRules)
      .values({
        ruleName: 'java-gate',
        ruleCategory: 'regex_title',
        pattern: '(?i)\\b(java|android)\\b',
        signalType: 'dealbreaker',
      })
      .run()
    const rule = db.select().from(signalRules).get()!

    const matched = recomputeRule(db, rule)

    expect(matched).toBe(2)
    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(2)
    for (const s of signals) {
      expect(s.signalType).toBe('dealbreaker')
      expect(s.score).toBe(0)
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
        },
        {
          ruleName: 'company-rule',
          ruleCategory: 'regex_company',
          pattern: '(?i)\\bacme\\b',
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
          enabled: true,
        },
        {
          ruleName: 'disabled-rule',
          ruleCategory: 'regex_title',
          pattern: '(?i)\\bjava\\b',
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
    expect(signals[0].score).toBe(0)
    db.$client.close()
  })

  it('flips a new job to blocked when a dealbreaker regex rule matches', () => {
    const db = createDb(':memory:')
    seed(db)
    db.insert(signalRules)
      .values({
        ruleName: 'java-dealbreaker',
        ruleCategory: 'regex_title',
        pattern: '(?i)\\b(java|android)\\b',
        signalType: 'dealbreaker',
      })
      .run()

    runEnabledRules(db)

    const job1 = db.select().from(jobs).where(eq(jobs.id, 1)).get()!
    const job2 = db.select().from(jobs).where(eq(jobs.id, 2)).get()!
    const job3 = db.select().from(jobs).where(eq(jobs.id, 3)).get()!

    expect(job1.status).toBe('blocked')
    expect(job2.status).toBe('new')
    expect(job3.status).toBe('blocked')

    db.$client.close()
  })

  it('reverts a blocked job to new when the dealbreaker signal no longer exists', () => {
    const db = createDb(':memory:')
    seed(db)
    db.insert(signalRules)
      .values({
        ruleName: 'java-dealbreaker',
        ruleCategory: 'regex_title',
        pattern: '(?i)\\b(java|android)\\b',
        signalType: 'dealbreaker',
      })
      .run()

    runEnabledRules(db)

    const job1Before = db.select().from(jobs).where(eq(jobs.id, 1)).get()!
    expect(job1Before.status).toBe('blocked')

    db.delete(signalRules).run()

    runEnabledRules(db)

    const job1After = db.select().from(jobs).where(eq(jobs.id, 1)).get()!
    expect(job1After.status).toBe('new')

    db.$client.close()
  })

  it('does not change the status of discovered/applied/skipped jobs even with dealbreaker signals', () => {
    const db = createDb(':memory:')
    seed(db)

    db.update(jobs).set({ status: 'discovered' }).where(eq(jobs.id, 1)).run()
    db.update(jobs).set({ status: 'applied' }).where(eq(jobs.id, 2)).run()
    db.update(jobs).set({ status: 'skipped' }).where(eq(jobs.id, 3)).run()

    db.insert(signalRules)
      .values({
        ruleName: 'java-dealbreaker',
        ruleCategory: 'regex_title',
        pattern: '(?i)\\b(java|android)\\b',
        signalType: 'dealbreaker',
      })
      .run()

    runEnabledRules(db)

    const job1 = db.select().from(jobs).where(eq(jobs.id, 1)).get()!
    const job2 = db.select().from(jobs).where(eq(jobs.id, 2)).get()!
    const job3 = db.select().from(jobs).where(eq(jobs.id, 3)).get()!

    expect(job1.status).toBe('discovered')
    expect(job2.status).toBe('applied')
    expect(job3.status).toBe('skipped')

    db.$client.close()
  })
})
