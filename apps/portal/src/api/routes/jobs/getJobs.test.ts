/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { type DB } from 'db'
import { build, createTestDb, JOB1, JOB2, JOB3, seedJob, seedSignal } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getJobs from './getJobs.js'

describe('GET /api/jobs', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getJobs, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns an empty page with defaults', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ count: 0, limit: 50, offset: 0, results: [] })
  })

  it('returns jobs sorted by posted date descending', async () => {
    for (const job of [JOB3, JOB1, JOB2]) {
      seedJob(db, job)
    }

    const res = await app.inject({ method: 'GET', url: '/' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string }> }
    expect(body.count).toBe(3)
    expect(body.results.map(j => j.providerJobId)).toEqual([JOB3.providerJobId, JOB2.providerJobId, JOB1.providerJobId])
  })

  it('paginates with limit and offset', async () => {
    for (const n of [1, 2, 3, 4, 5]) {
      seedJob(db, { ...JOB1, providerJobId: `j${n}`, title: `Job ${n}` })
    }

    const res = await app.inject({ method: 'GET', url: '/?limit=2&offset=2' })
    const body = res.json()
    expect(body.limit).toBe(2)
    expect(body.offset).toBe(2)
    expect(body.results).toHaveLength(2)
    expect(body.count).toBe(5)
  })

  it('clamps limit and ignores invalid values', async () => {
    const capped = await app.inject({ method: 'GET', url: '/?limit=99999' })
    expect(capped.json().limit).toBe(200)

    const invalid = await app.inject({ method: 'GET', url: '/?limit=abc' })
    expect(invalid.json().limit).toBe(50)
  })
})

describe('GET /api/jobs signal summary join', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getJobs, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('joins the signal summary onto each job', async () => {
    const jobA = seedJob(db, JOB1)
    const jobB = seedJob(db, JOB2)
    seedSignal(db, { jobId: jobA.id, source: 'regex_title', signalType: 'skill_match', score: 5 })
    seedSignal(db, {
      jobId: jobA.id,
      source: 'llm_deep_eval',
      signalType: 'skill_match',
      score: 75,
      metadata: JSON.stringify({ dimension: 'technical' }),
    })
    seedSignal(db, { jobId: jobB.id, source: 'manual_review', signalType: 'company_match', score: 2 })

    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    const results = res.json().results as Array<{
      providerJobId: string
      signals: {
        signalCount: number
        gated: boolean
        dimensions: Record<string, number>
        baseScore: number
      }
    }>
    expect(results.find(j => j.providerJobId === JOB1.providerJobId)).toMatchObject({
      signals: { signalCount: 2, gated: false, dimensions: { technical: 75 }, baseScore: 5 },
    })
    expect(results.find(j => j.providerJobId === JOB2.providerJobId)).toMatchObject({
      signals: { signalCount: 1, gated: false, dimensions: {}, baseScore: 2 },
    })
  })

  it('sets gated=true when a job has a dealbreaker signal', async () => {
    const job = seedJob(db, JOB1)
    seedSignal(db, { jobId: job.id, source: 'regex_title', signalType: 'skill_match', score: 10 })
    seedSignal(db, { jobId: job.id, source: 'llm_deep_eval', signalType: 'dealbreaker', score: -50 })

    const res = await app.inject({ method: 'GET', url: '/' })
    const jobJson = res.json().results[0]
    expect(jobJson.signals.gated).toBe(true)
    expect(jobJson.signals.baseScore).toBe(10)
  })

  it('zero-fills the summary for jobs without signals', async () => {
    seedJob(db, JOB1)

    const res = await app.inject({ method: 'GET', url: '/' })
    const jobJson = res.json().results[0]
    expect(jobJson).toMatchObject({
      signals: { signalCount: 0, gated: false, dimensions: {}, baseScore: 0 },
    })
  })
})

describe('GET /api/jobs description serialization', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  function insertJob(description: string | null): void {
    seedJob(db, {
      ...JOB1,
      providerJobId: `d-${description?.slice(0, 8) ?? 'none'}`,
      title: 'Job',
      description,
    })
  }

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getJobs, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('renders markdown headings and lists to HTML', async () => {
    insertJob('## Heading\n\n- item')
    const res = await app.inject({ method: 'GET', url: '/' })
    const html = res.json().results[0].descriptionHtml as string
    expect(html).toContain('<h2>Heading</h2>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>item</li>')
  })

  it('strips raw HTML embedded in markdown', async () => {
    insertJob('<script>alert(1)</script>\n\nSafe text')
    const res = await app.inject({ method: 'GET', url: '/' })
    const html = res.json().results[0].descriptionHtml as string
    expect(html).not.toContain('<script')
    expect(html).toContain('Safe text')
  })

  it('omits the raw description markdown from the response', async () => {
    insertJob('## Heading')
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.json().results[0]).not.toHaveProperty('description')
  })

  it('round-trips plain text as a single paragraph', async () => {
    insertJob('Just plain text')
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.json().results[0].descriptionHtml).toBe('<p>Just plain text</p>')
  })

  it('returns null descriptionHtml for jobs without a description', async () => {
    insertJob(null)
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.json().results[0].descriptionHtml).toBeNull()
  })
})
