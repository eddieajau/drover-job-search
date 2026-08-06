/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { createDb, jobSignals, jobs, type DB } from 'db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { summariseSignals } from './signals-summary.js'

describe('summariseSignals', () => {
  let db: DB

  beforeEach(() => {
    db = createDb(':memory:')
  })

  afterEach(() => {
    db.$client.close()
  })

  function insertJob(providerJobId: string) {
    return db
      .insert(jobs)
      .values({
        providerJobId,
        title: providerJobId,
        companyName: 'Co',
        url: `https://${providerJobId}`,
        location: 'Brisbane',
      })
      .returning()
      .get()
  }

  it('returns an empty map for empty job ids', () => {
    expect(summariseSignals(db, [])).toEqual(new Map())
  })

  it('omits jobs with no signals from the map', () => {
    const job = insertJob('a')
    const totals = summariseSignals(db, [job.id])
    expect(totals.has(job.id)).toBe(false)
  })

  it('sums non-dimension scores into baseScore per job', () => {
    const jobA = insertJob('a')
    const jobB = insertJob('b')
    db.insert(jobSignals)
      .values([
        { jobId: jobA.id, source: 'regex_title', signalType: 'skill_match', score: 5 },
        { jobId: jobA.id, source: 'regex_company', signalType: 'company_match', score: -3 },
        { jobId: jobB.id, source: 'manual_review', signalType: 'company_match', score: 2 },
      ])
      .run()

    const totals = summariseSignals(db, [jobA.id, jobB.id])
    expect(totals.get(jobA.id)).toEqual({ signalCount: 2, gated: false, dimensions: {}, baseScore: 2 })
    expect(totals.get(jobB.id)).toEqual({ signalCount: 1, gated: false, dimensions: {}, baseScore: 2 })
  })

  it('sets gated=true when any signal has signalType dealbreaker', () => {
    const job = insertJob('a')
    db.insert(jobSignals)
      .values([
        { jobId: job.id, source: 'regex_title', signalType: 'skill_match', score: 10 },
        { jobId: job.id, source: 'llm_deep_eval', signalType: 'dealbreaker', score: -50 },
      ])
      .run()

    const totals = summariseSignals(db, [job.id])
    expect(totals.get(job.id)?.gated).toBe(true)
    expect(totals.get(job.id)?.baseScore).toBe(10)
  })

  it('accumulates dimension scores separately from baseScore', () => {
    const job = insertJob('a')
    db.insert(jobSignals)
      .values([
        {
          jobId: job.id,
          source: 'llm_deep_eval',
          signalType: 'skill_match',
          score: 75,
          metadata: JSON.stringify({ dimension: 'technical', matched_keywords: ['TypeScript'], reason: 'match' }),
        },
        {
          jobId: job.id,
          source: 'llm_deep_eval',
          signalType: 'company_match',
          score: 80,
          metadata: JSON.stringify({ dimension: 'career', matched_keywords: ['staff'], reason: 'match' }),
        },
        { jobId: job.id, source: 'regex_description', signalType: 'skill_match', score: 5 },
      ])
      .run()

    const totals = summariseSignals(db, [job.id])
    expect(totals.get(job.id)).toEqual({
      signalCount: 3,
      gated: false,
      dimensions: { technical: 75, career: 80 },
      baseScore: 5,
    })
  })

  it('ignores metadata without a recognised dimension as baseScore', () => {
    const job = insertJob('a')
    db.insert(jobSignals)
      .values([
        {
          jobId: job.id,
          source: 'llm_deep_eval',
          signalType: 'skill_match',
          score: 60,
          metadata: JSON.stringify({ foo: 'bar' }),
        },
        {
          jobId: job.id,
          source: 'llm_deep_eval',
          signalType: 'skill_match',
          score: 40,
          metadata: JSON.stringify({ dimension: 'soft_skills' }),
        },
        { jobId: job.id, source: 'llm_deep_eval', signalType: 'skill_match', score: 30, metadata: JSON.stringify({}) },
      ])
      .run()

    const totals = summariseSignals(db, [job.id])
    expect(totals.get(job.id)).toEqual({ signalCount: 3, gated: false, dimensions: {}, baseScore: 130 })
  })

  it('ignores job ids that do not exist', () => {
    const job = insertJob('a')
    db.insert(jobSignals).values({ jobId: job.id, source: 'regex_title', signalType: 'skill_match', score: 7 }).run()

    const totals = summariseSignals(db, [job.id, 999])
    expect(totals.get(job.id)).toEqual({ signalCount: 1, gated: false, dimensions: {}, baseScore: 7 })
    expect(totals.has(999)).toBe(false)
  })
})
