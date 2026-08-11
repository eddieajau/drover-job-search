/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobSignals, signalRules, type DB } from 'db'
import { build, createTestDb, seedFact, seedJob, seedRule } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import postRulesSeed from './postRulesSeed.js'

const JOB_NET = {
  providerJobId: 'net-1',
  title: 'Senior .NET Developer',
  companyName: 'Acme Corp',
  url: 'https://example.com/jobs/net-1',
  location: 'Remote',
}

const JOB_FRONTEND = {
  providerJobId: 'fe-1',
  title: 'Frontend Engineer',
  companyName: 'Acme Corp',
  url: 'https://example.com/jobs/fe-1',
  location: 'Remote',
}

const JOB_JAVA = {
  providerJobId: 'java-1',
  title: 'Senior Java Developer',
  companyName: 'Acme Corp',
  url: 'https://example.com/jobs/java-1',
  location: 'Remote',
}

describe('POST /api/rules/seed-from-facts', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(postRulesSeed, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('creates dealbreaker rules from active gap facts and recomputes signals', async () => {
    const gap = seedFact(db, { category: 'gap', label: 'No professional .NET or Java experience' })
    seedJob(db, JOB_NET)
    seedJob(db, JOB_FRONTEND)

    const res = await app.inject({ method: 'POST', url: '/seed-from-facts' })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ created: 1 })

    const rules = db.select().from(signalRules).all()
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({
      ruleName: `gap-fact-${gap.id}`,
      ruleCategory: 'regex_title',
      pattern: '(?i)(?:(?<!\\w)\\.net\\b|\\bjava\\b)',
      signalType: 'dealbreaker',
    })

    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(1)
    expect(signals[0]).toMatchObject({
      jobId: 1,
      ruleId: rules[0]!.id,
      source: 'regex_title',
      signalType: 'dealbreaker',
    })
  })

  it('leaves existing rules untouched and does not duplicate on re-run', async () => {
    seedRule(db, {
      ruleName: 'no-java',
      ruleCategory: 'regex_title',
      pattern: '(?i)\\bjava\\b',
      signalType: 'dealbreaker',
    })
    seedFact(db, { category: 'gap', label: 'No professional Java experience' })
    seedJob(db, JOB_JAVA)

    const first = await app.inject({ method: 'POST', url: '/seed-from-facts' })
    expect(first.statusCode).toBe(201)
    expect(first.json()).toEqual({ created: 1 })

    const second = await app.inject({ method: 'POST', url: '/seed-from-facts' })
    expect(second.statusCode).toBe(201)
    expect(second.json()).toEqual({ created: 0 })

    const rules = db.select().from(signalRules).all()
    expect(rules).toHaveLength(2)
    expect(rules.some(rule => rule.ruleName === 'no-java')).toBe(true)

    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(1)
  })

  it('skips inactive gap facts and facts with no technology tokens', async () => {
    seedFact(db, { category: 'gap', label: 'No professional Java experience', active: false })
    seedFact(db, { category: 'gap', label: 'No professional experience' })
    seedFact(db, { category: 'gap', label: 'No C++ or C# experience' })

    const res = await app.inject({ method: 'POST', url: '/seed-from-facts' })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ created: 1 })

    const rules = db.select().from(signalRules).all()
    expect(rules).toHaveLength(1)
    expect(rules[0]?.ruleName).toBe('gap-fact-3')
  })

  it('creates nothing when there are no gap facts', async () => {
    const res = await app.inject({ method: 'POST', url: '/seed-from-facts' })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ created: 0 })
    expect(db.select().from(signalRules).all()).toHaveLength(0)
  })
})
