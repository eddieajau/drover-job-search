/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { createDb, jobSignals, jobs, type DB } from 'db'
import fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getJobs from './getJobs.js'

describe('GET /api/jobs', () => {
  let db: DB
  let app: FastifyInstance

  beforeEach(async () => {
    db = createDb(':memory:')
    app = fastify()
    await app.register(getJobs, { db })
    await app.ready()
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
    db.insert(jobs)
      .values([
        {
          providerJobId: 'a',
          title: 'A',
          companyName: 'Co',
          url: 'https://a',
          location: 'Brisbane',
          postedAt: '2026-01-01',
        },
        {
          providerJobId: 'b',
          title: 'B',
          companyName: 'Co',
          url: 'https://b',
          location: 'Brisbane',
          postedAt: '2026-03-01',
        },
        {
          providerJobId: 'c',
          title: 'C',
          companyName: 'Co',
          url: 'https://c',
          location: 'Brisbane',
          postedAt: '2026-02-01',
        },
      ])
      .run()

    const res = await app.inject({ method: 'GET', url: '/' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string }> }
    expect(body.count).toBe(3)
    expect(body.results.map(j => j.providerJobId)).toEqual(['b', 'c', 'a'])
  })

  it('paginates with limit and offset', async () => {
    db.insert(jobs)
      .values(
        [1, 2, 3, 4, 5].map(n => ({
          providerJobId: `j${n}`,
          title: `Job ${n}`,
          companyName: 'Co',
          url: `https://j${n}`,
          location: 'Brisbane',
        }))
      )
      .run()

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
  let app: FastifyInstance

  beforeEach(async () => {
    db = createDb(':memory:')
    app = fastify()
    await app.register(getJobs, { db })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('joins the signal summary onto each job', async () => {
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
        {
          jobId: jobA.id,
          source: 'regex_title',
          signalType: 'skill_match',
          score: 5,
        },
        {
          jobId: jobA.id,
          source: 'llm_deep_eval',
          signalType: 'skill_match',
          score: 75,
          metadata: JSON.stringify({ dimension: 'technical' }),
        },
        { jobId: jobB.id, source: 'manual_review', signalType: 'company_match', score: 2 },
      ])
      .run()

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
    expect(results.find(j => j.providerJobId === 'a')).toMatchObject({
      signals: { signalCount: 2, gated: false, dimensions: { technical: 75 }, baseScore: 5 },
    })
    expect(results.find(j => j.providerJobId === 'b')).toMatchObject({
      signals: { signalCount: 1, gated: false, dimensions: {}, baseScore: 2 },
    })
  })

  it('sets gated=true when a job has a dealbreaker signal', async () => {
    const job = db
      .insert(jobs)
      .values({ providerJobId: 'a', title: 'A', companyName: 'Co', url: 'https://a', location: 'Brisbane' })
      .returning()
      .get()
    db.insert(jobSignals)
      .values([
        { jobId: job.id, source: 'regex_title', signalType: 'skill_match', score: 10 },
        { jobId: job.id, source: 'llm_deep_eval', signalType: 'dealbreaker', score: -50 },
      ])
      .run()

    const res = await app.inject({ method: 'GET', url: '/' })
    const jobJson = res.json().results[0]
    expect(jobJson.signals.gated).toBe(true)
    expect(jobJson.signals.baseScore).toBe(10)
  })

  it('zero-fills the summary for jobs without signals', async () => {
    db.insert(jobs)
      .values({ providerJobId: 'a', title: 'A', companyName: 'Co', url: 'https://a', location: 'Brisbane' })
      .run()

    const res = await app.inject({ method: 'GET', url: '/' })
    const jobJson = res.json().results[0]
    expect(jobJson).toMatchObject({
      signals: { signalCount: 0, gated: false, dimensions: {}, baseScore: 0 },
    })
  })
})

describe('GET /api/jobs description serialization', () => {
  let db: DB
  let app: FastifyInstance

  function insertJob(description: string | null): void {
    db.insert(jobs)
      .values({
        providerJobId: `d-${description?.slice(0, 8) ?? 'none'}`,
        title: 'Job',
        companyName: 'Co',
        url: 'https://d',
        location: 'Brisbane',
        description,
      })
      .run()
  }

  beforeEach(async () => {
    db = createDb(':memory:')
    app = fastify()
    await app.register(getJobs, { db })
    await app.ready()
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
