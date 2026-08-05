/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import sensible from '@fastify/sensible'
import { createDb, jobSignals, jobs, type DB } from 'db'
import fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getSummary from './getSummary.js'

describe('GET /api/signals/summary', () => {
  let db: DB
  let app: FastifyInstance

  beforeEach(async () => {
    db = createDb(':memory:')
    app = fastify()
    await app.register(sensible)
    await app.register(getSummary, { db })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('sums netScore per job for the given ids', async () => {
    const jobA = db
      .insert(jobs)
      .values({ providerJobId: 'a', title: 'A', companyName: 'Co', url: 'https://a', location: 'Brisbane' })
      .returning()
      .get()
    const jobB = db
      .insert(jobs)
      .values({ providerJobId: 'b', title: 'B', companyName: 'Co', url: 'https://b', location: 'Brisbane' })
      .returning()
      .get()
    db.insert(jobSignals)
      .values([
        { jobId: jobA.id, source: 'regex_title', signalType: 'skill_match', score: 5 },
        { jobId: jobA.id, source: 'regex_company', signalType: 'company_match', score: -3 },
        { jobId: jobB.id, source: 'manual_review', signalType: 'company_match', score: 2 },
      ])
      .run()

    const res = await app.inject({ method: 'GET', url: '/?provider=linkedin&ids=a,b' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      a: { netScore: 2, signalCount: 2, gated: false },
      b: { netScore: 2, signalCount: 1, gated: false },
    })
  })

  it('reports zero totals for jobs with no signals', async () => {
    db.insert(jobs)
      .values({ providerJobId: 'a', title: 'A', companyName: 'Co', url: 'https://a', location: 'Brisbane' })
      .run()

    const res = await app.inject({ method: 'GET', url: '/?provider=linkedin&ids=a' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ a: { netScore: 0, signalCount: 0, gated: false } })
  })

  it('returns an empty object for an empty id list', async () => {
    const res = await app.inject({ method: 'GET', url: '/?provider=linkedin&ids=' })
    expect(res.statusCode).toBe(400)
  })

  it('sets gated=true when any signal has signal_type=dealbreaker', async () => {
    const jobA = db
      .insert(jobs)
      .values({ providerJobId: 'a', title: 'A', companyName: 'Co', url: 'https://a', location: 'Brisbane' })
      .returning()
      .get()
    db.insert(jobSignals)
      .values([
        { jobId: jobA.id, source: 'regex_title', signalType: 'skill_match', score: 10 },
        { jobId: jobA.id, source: 'llm_deep_eval', signalType: 'dealbreaker', score: -50 },
      ])
      .run()

    const res = await app.inject({ method: 'GET', url: '/?provider=linkedin&ids=a' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.a.gated).toBe(true)
    expect(body.a.netScore).toBe(10)
  })
})
