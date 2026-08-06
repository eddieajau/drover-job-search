import { jobSignals, jobs, signalRules, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { SIGNAL_MANUAL, SIGNAL_TITLE_MATCH } from './ids.js'
import { JOB1, JOB2 } from './jobs.js'
import { RULE_JAVA, RULE_RECRUITER } from './rules.js'
import { createTestDb, seedDatabase, seedJob, seedQuery, seedRule, seedSignal } from './seed.js'

function seeded(): DB {
  return seedDatabase(createTestDb())
}

describe('createTestDb', () => {
  it('builds a fresh in-memory database per call', () => {
    const first = createTestDb()
    const second = createTestDb()
    expect(second).not.toBe(first)
    first.$client.close()
    second.$client.close()
  })
})

describe('seedDatabase', () => {
  it('seeds the canonical jobs with stable provider ids', () => {
    const db = seeded()
    const rows = db.select().from(jobs).all()
    expect(rows.map(job => job.providerJobId)).toEqual([JOB1.providerJobId, JOB2.providerJobId])
    db.$client.close()
  })

  it('seeds the canonical rules with stable names', () => {
    const db = seeded()
    const rows = db.select().from(signalRules).all()
    expect(rows.map(rule => rule.ruleName)).toEqual([RULE_JAVA.ruleName, RULE_RECRUITER.ruleName])
    db.$client.close()
  })

  it('seeds two signals wired to the canonical jobs and rules', () => {
    const db = seeded()
    const rows = db.select().from(jobSignals).all()
    expect(rows).toHaveLength(2)
    const bySource = new Map(rows.map(signal => [signal.source, signal]))
    expect(bySource.get(SIGNAL_TITLE_MATCH)).toMatchObject({ signalType: 'skill_match', score: 5 })
    expect(bySource.get(SIGNAL_MANUAL)).toMatchObject({ signalType: 'company_match', score: -10 })
    db.$client.close()
  })

  it('skips signals when opted out', () => {
    const db = seedDatabase(createTestDb(), { signals: false })
    expect(db.select().from(jobSignals).all()).toHaveLength(0)
    db.$client.close()
  })
})

describe('seed helpers', () => {
  it('seedJob round-trips a job and returns its row', () => {
    const db = createTestDb()
    const job = seedJob(db, {
      providerJobId: 'abc',
      title: 'Engineer',
      companyName: 'Co',
      url: 'https://x',
      location: 'Brisbane',
    })
    expect(job.providerJobId).toBe('abc')
    const row = db.select().from(jobs).where(eq(jobs.providerJobId, 'abc')).get()
    expect(row?.title).toBe('Engineer')
    db.$client.close()
  })

  it('seedRule round-trips a rule and returns its row', () => {
    const db = createTestDb()
    const rule = seedRule(db, {
      ruleName: 'Agency',
      ruleCategory: 'regex_title',
      pattern: '(?i)\\bagency\\b',
      signalType: 'dealbreaker',
    })
    expect(rule.signalType).toBe('dealbreaker')
    db.$client.close()
  })

  it('seedSignal round-trips a signal and returns its row', () => {
    const db = createTestDb()
    const job = seedJob(db, {
      providerJobId: 'abc',
      title: 'Engineer',
      companyName: 'Co',
      url: 'https://x',
      location: 'Brisbane',
    })
    const signal = seedSignal(db, { jobId: job.id, source: 'manual_review', signalType: 'company_match', score: 3 })
    expect(signal.score).toBe(3)
    db.$client.close()
  })

  it('seedQuery round-trips a query and returns its row', () => {
    const db = createTestDb()
    const query = seedQuery(db, {
      queryText: 'Engineer',
      queryOptions: JSON.stringify({ location: 'Brisbane', workType: 'hybrid' }),
    })
    expect(query.queryText).toBe('Engineer')
    expect(query.queryOptions).toBe(JSON.stringify({ location: 'Brisbane', workType: 'hybrid' }))
    db.$client.close()
  })

  it('seedRule rejects a duplicate rule name', () => {
    const db = seeded()
    expect(() => seedRule(db, RULE_JAVA)).toThrow(/UNIQUE/)
    db.$client.close()
  })
})
