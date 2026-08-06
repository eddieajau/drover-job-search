/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { type DB } from 'db'
import { build, createTestDb, JOB1, RULE_JAVA, seedJob, seedRule, seedSignal } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getSignals from './getSignals.js'

describe('GET /api/signals', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getSignals, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns 404 for an unknown job', async () => {
    const res = await app.inject({ method: 'GET', url: '/?provider=linkedin&providerJobId=nope' })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for a missing providerJobId', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(400)
  })

  it('returns seeded signals with parsed metadata', async () => {
    const job = seedJob(db, JOB1)
    const rule = seedRule(db, RULE_JAVA)
    seedSignal(db, {
      jobId: job.id,
      ruleId: rule.id,
      source: 'regex_title',
      signalType: 'skill_match',
      score: 5,
      metadata: JSON.stringify({ matched_keywords: ['Java'] }),
    })
    seedSignal(db, { jobId: job.id, source: 'manual_review', signalType: 'company_match', score: 3 })

    const res = await app.inject({
      method: 'GET',
      url: `/?provider=linkedin&providerJobId=${JOB1.providerJobId}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({
      ruleId: rule.id,
      source: 'regex_title',
      signalType: 'skill_match',
      score: 5,
      metadata: { matched_keywords: ['Java'] },
    })
    expect(body[1]).toMatchObject({ ruleId: null, source: 'manual_review', score: 3 })
    expect(body[1].metadata).toBeUndefined()
  })
})
