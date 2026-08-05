/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import sensible from '@fastify/sensible'
import { createDb, jobSignals, jobs, signalRules, type DB } from 'db'
import fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getSignals from './getSignals.js'

describe('GET /api/signals', () => {
  let db: DB
  let app: FastifyInstance

  beforeEach(async () => {
    db = createDb(':memory:')
    app = fastify()
    await app.register(sensible)
    await app.register(getSignals, { db })
    await app.ready()
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
    const job = db
      .insert(jobs)
      .values({ providerJobId: 'abc', title: 'Engineer', companyName: 'Co', url: 'https://x', location: 'Brisbane' })
      .returning()
      .get()
    const rule = db
      .insert(signalRules)
      .values({ ruleName: 'Java', ruleCategory: 'regex_title', pattern: '(?i)\\bjava\\b', scoreModifier: 5 })
      .returning()
      .get()
    db.insert(jobSignals)
      .values([
        {
          jobId: job.id,
          ruleId: rule.id,
          source: 'regex_title',
          signalType: 'skill_match',
          score: 5,
          metadata: JSON.stringify({ matched_keywords: ['Java'] }),
        },
        { jobId: job.id, source: 'manual_review', signalType: 'company_match', score: 3 },
      ])
      .run()

    const res = await app.inject({ method: 'GET', url: '/?provider=linkedin&providerJobId=abc' })
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
