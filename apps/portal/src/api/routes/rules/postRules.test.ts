/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobSignals, signalRules, type DB } from 'db'
import { build, createTestDb, JOB1, RULE_JAVA, RULE_RECRUITER, seedJob, seedRule, seedSignal } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import postRules from './postRules.js'

describe('POST /api/rules', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(postRules, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('creates rules without an id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: [
        RULE_JAVA,
        { ruleName: 'Blockchain', ruleCategory: 'regex_description', pattern: '(?i)\\bblockchain\\b' },
      ],
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({
      ruleName: 'Java',
      ruleCategory: 'regex_title',
      pattern: '(?i)\\bjava\\b',
      enabled: true,
    })
    expect(body[1]).toMatchObject({ ruleName: 'Blockchain', enabled: true })
  })

  it('updates existing rules by id, preserving ids', async () => {
    const inserted = seedRule(db, RULE_JAVA)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: [
        {
          id: inserted.id,
          ruleName: 'Java+Android',
          ruleCategory: 'regex_title',
          pattern: '(?i)\\b(java|android)\\b',
          enabled: false,
        },
      ],
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      id: inserted.id,
      ruleName: 'Java+Android',
      pattern: '(?i)\\b(java|android)\\b',
      enabled: false,
    })
  })

  it('deletes rules missing from the sent array', async () => {
    const kept = seedRule(db, RULE_JAVA)
    seedRule(db, RULE_RECRUITER)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: [{ id: kept.id, ...RULE_JAVA }],
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)

    const remaining = db.select().from(signalRules).all()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(kept.id)
  })

  it('mixes create, update, and delete in one call', async () => {
    const stale = seedRule(db, {
      ruleName: 'Stale',
      ruleCategory: 'regex_title',
      pattern: 'stale',
    })
    const kept = seedRule(db, RULE_JAVA)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: [
        { id: kept.id, ...RULE_JAVA },
        { ruleName: 'Android', ruleCategory: 'regex_title', pattern: '(?i)\\bandroid\\b' },
      ],
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(2)
    expect(body.map((rule: { id: number }) => rule.id)).toEqual([kept.id, body[1].id])
    expect(body.find((rule: { id: number }) => rule.id === kept.id)).toMatchObject({ signalType: 'skill_match' })

    const remaining = db.select().from(signalRules).all()
    expect(remaining).toHaveLength(2)
    expect(remaining.some(rule => rule.id === stale.id)).toBe(false)
  })

  it('round-trips a dealbreaker signalType through the upsert', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: [
        { ruleName: 'Agency', ruleCategory: 'regex_title', pattern: '(?i)\\bagency\\b', signalType: 'dealbreaker' },
      ],
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body[0]).toMatchObject({
      ruleName: 'Agency',
      ruleCategory: 'regex_title',
      pattern: '(?i)\\bagency\\b',
      signalType: 'dealbreaker',
    })

    const updated = await app.inject({
      method: 'POST',
      url: '/',
      payload: [{ id: body[0].id, ruleName: 'Agency', ruleCategory: 'regex_title', pattern: '(?i)\\bagency\\b' }],
    })
    const kept = updated.json()
    expect(kept[0]).toMatchObject({ signalType: 'dealbreaker' })
  })

  it('deletes all rules when sent an empty array', async () => {
    seedRule(db, RULE_JAVA)

    const res = await app.inject({ method: 'POST', url: '/', payload: [] })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])

    const remaining = db.select().from(signalRules).all()
    expect(remaining).toHaveLength(0)
  })

  it('removes signals when their rule is deleted', async () => {
    const rule = seedRule(db, RULE_JAVA)
    const job = seedJob(db, JOB1)
    seedSignal(db, { jobId: job.id, ruleId: rule.id, source: 'regex_title', signalType: 'skill_match', score: 5 })

    const res = await app.inject({ method: 'POST', url: '/', payload: [] })
    expect(res.statusCode).toBe(200)

    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(0)
  })

  it('drops unknown ids without error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: [{ id: 999, ruleName: 'x', ruleCategory: 'regex_title', pattern: 'x' }],
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('rejects a bad rule_category', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: [{ ruleName: 'x', ruleCategory: 'regex_company_name', pattern: 'x' }],
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a missing pattern', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: [{ ruleName: 'x', ruleCategory: 'regex_title' }],
    })
    expect(res.statusCode).toBe(400)
  })
})
