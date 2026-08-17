/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs, type DB, type Job } from 'db'
import { eq } from 'drizzle-orm'
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
        netScore?: number
      }
    }>
    expect(results.find(j => j.providerJobId === JOB1.providerJobId)).toMatchObject({
      signals: { signalCount: 2, gated: false, dimensions: { technical: 75 }, baseScore: 5, netScore: 28 },
    })
    expect(results.find(j => j.providerJobId === JOB2.providerJobId)).toMatchObject({
      signals: { signalCount: 1, gated: false, dimensions: {}, baseScore: 2, netScore: 2 },
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

describe('GET /api/jobs queued join', () => {
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

  it('marks a job queued when an analysis_queue row exists', async () => {
    const jobA = seedJob(db, JOB1)
    seedJob(db, JOB2)
    db.insert(analysisQueue).values({ jobId: jobA.id, topic: 'fetch_job_details' }).run()

    const res = await app.inject({ method: 'GET', url: '/' })
    const results = res.json().results as Array<{ providerJobId: string; queued: boolean }>
    expect(results.find(j => j.providerJobId === JOB1.providerJobId)?.queued).toBe(true)
    expect(results.find(j => j.providerJobId === JOB2.providerJobId)?.queued).toBe(false)
  })

  it('returns queued=false when no analysis_queue rows exist', async () => {
    seedJob(db, JOB1)

    const res = await app.inject({ method: 'GET', url: '/' })
    const jobJson = res.json().results[0]
    expect(jobJson.queued).toBe(false)
  })
})

describe('GET /api/jobs status pass-through and filtering', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  function seedWith(job: typeof JOB1, status: string): Job {
    const row = seedJob(db, { ...job, providerJobId: `${job.providerJobId}-${status}` })
    db.update(jobs).set({ status }).where(eq(jobs.id, row.id)).run()
    return row
  }

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getJobs, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('passes a default new job status through unchanged', async () => {
    seedJob(db, JOB1)

    const res = await app.inject({ method: 'GET', url: '/' })
    const results = res.json().results as Array<{ providerJobId: string; status: string }>
    expect(results[0].status).toBe('new')
  })

  it('passes discovered, applied, and skipped rows through unchanged', async () => {
    seedWith(JOB1, 'discovered')
    seedWith(JOB2, 'applied')
    seedWith(JOB3, 'skipped')

    const res = await app.inject({ method: 'GET', url: '/' })
    const results = res.json().results as Array<{ providerJobId: string; status: string }>
    expect(results.find(j => j.providerJobId === 'job-1-discovered')?.status).toBe('discovered')
    expect(results.find(j => j.providerJobId === 'job-2-applied')?.status).toBe('applied')
    expect(results.find(j => j.providerJobId === 'job-3-skipped')?.status).toBe('skipped')
  })

  it('filters by status so a status=new request omits the other buckets', async () => {
    seedWith(JOB1, 'new')
    seedWith(JOB2, 'discovered')
    seedWith(JOB3, 'applied')
    seedWith(JOB1, 'skipped')

    const res = await app.inject({ method: 'GET', url: '/?status=new' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string; status: string }> }
    expect(body.count).toBe(1)
    expect(body.results).toHaveLength(1)
    expect(body.results[0].providerJobId).toBe('job-1-new')
    expect(body.results[0].status).toBe('new')
  })

  it('filters by status=blocked and returns only rows with stored status blocked', async () => {
    seedWith(JOB1, 'blocked')
    seedWith(JOB2, 'new')
    seedWith(JOB3, 'discovered')

    const res = await app.inject({ method: 'GET', url: '/?status=blocked' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string; status: string }> }
    expect(body.count).toBe(1)
    expect(body.results).toHaveLength(1)
    expect(body.results[0].providerJobId).toBe('job-1-blocked')
    expect(body.results[0].status).toBe('blocked')
  })

  it('filters by status=unsuccessful and returns only matching rows', async () => {
    seedWith(JOB1, 'unsuccessful')
    seedWith(JOB2, 'new')
    seedWith(JOB3, 'applied')

    const res = await app.inject({ method: 'GET', url: '/?status=unsuccessful' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string; status: string }> }
    expect(body.count).toBe(1)
    expect(body.results).toHaveLength(1)
    expect(body.results[0].providerJobId).toBe('job-1-unsuccessful')
    expect(body.results[0].status).toBe('unsuccessful')
  })

  it('filters by status=successful and returns only matching rows', async () => {
    seedWith(JOB1, 'successful')
    seedWith(JOB2, 'new')
    seedWith(JOB3, 'applied')

    const res = await app.inject({ method: 'GET', url: '/?status=successful' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string; status: string }> }
    expect(body.count).toBe(1)
    expect(body.results).toHaveLength(1)
    expect(body.results[0].providerJobId).toBe('job-1-successful')
    expect(body.results[0].status).toBe('successful')
  })

  it('returns only gated jobs when score=blocked and count matches', async () => {
    const gated = seedJob(db, JOB1)
    seedSignal(db, { jobId: gated.id, source: 'regex_title', signalType: 'dealbreaker', score: -50 })
    seedJob(db, JOB2)
    seedJob(db, JOB3)

    const res = await app.inject({ method: 'GET', url: '/?score=blocked' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string }> }
    expect(body.count).toBe(1)
    expect(body.results).toHaveLength(1)
    expect(body.results[0].providerJobId).toBe(JOB1.providerJobId)
  })

  it('returns only non-gated hot jobs when score=hot', async () => {
    const hot = seedJob(db, JOB1)
    for (const [source, dimension] of [
      ['llm_deep_eval', 'technical'],
      ['regex_title', 'experience'],
      ['regex_company', 'behavioral'],
      ['regex_description', 'career'],
    ] as const) {
      seedSignal(db, {
        jobId: hot.id,
        source,
        signalType: 'skill_match',
        score: 100,
        metadata: JSON.stringify({ dimension }),
      })
    }
    const lukewarm = seedJob(db, JOB2)
    seedSignal(db, { jobId: lukewarm.id, source: 'regex_title', signalType: 'skill_match', score: 10 })
    const blocked = seedJob(db, JOB3)
    seedSignal(db, { jobId: blocked.id, source: 'regex_title', signalType: 'dealbreaker', score: -50 })

    const res = await app.inject({ method: 'GET', url: '/?score=hot' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string }> }
    expect(body.count).toBe(1)
    expect(body.results[0].providerJobId).toBe(JOB1.providerJobId)
  })

  it('returns non-gated jobs when score=scorable and matches a filtered page', async () => {
    seedWith(JOB1, 'new')
    const blocked = seedWith(JOB2, 'discovered')
    seedSignal(db, { jobId: blocked.id, source: 'regex_title', signalType: 'dealbreaker', score: -50 })

    const res = await app.inject({ method: 'GET', url: '/?status=new&score=scorable' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string }> }
    expect(body.count).toBe(1)
    expect(body.results).toHaveLength(1)
    expect(body.results[0].providerJobId).toBe('job-1-new')
  })

  it('keeps count matching the filtered set when the page is smaller than the result set', async () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      seedJob(db, { ...JOB1, providerJobId: `n${n}`, title: `Job ${n}` })
    }
    const blocked = seedJob(db, JOB2)
    seedSignal(db, { jobId: blocked.id, source: 'regex_title', signalType: 'dealbreaker', score: -50 })

    const res = await app.inject({ method: 'GET', url: '/?score=scorable&limit=5' })
    const body = res.json() as { count: number; results: unknown[] }
    expect(body.count).toBe(6)
    expect(body.results).toHaveLength(5)
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

describe('GET /api/jobs search', () => {
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

  it('filters by title match case-insensitively', async () => {
    seedJob(db, JOB1)
    seedJob(db, { ...JOB2, title: 'Go Developer' })
    seedJob(db, JOB3)

    const res = await app.inject({ method: 'GET', url: '/?q=go' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string; title: string }> }
    expect(body.count).toBe(1)
    expect(body.results).toHaveLength(1)
    expect(body.results[0].providerJobId).toBe('job-2')
  })

  it('filters by companyName match case-insensitively', async () => {
    seedJob(db, JOB1)
    seedJob(db, { ...JOB2, companyName: 'Golang Inc' })
    seedJob(db, JOB3)

    const res = await app.inject({ method: 'GET', url: '/?q=go' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string; companyName: string }> }
    expect(body.count).toBe(1)
    expect(body.results).toHaveLength(1)
    expect(body.results[0].providerJobId).toBe('job-2')
  })

  it('matches title OR companyName', async () => {
    seedJob(db, JOB1)
    seedJob(db, { ...JOB2, title: 'Go Developer', companyName: 'Other' })
    seedJob(db, { ...JOB3, title: 'Other Title', companyName: 'Go Corp' })

    const res = await app.inject({ method: 'GET', url: '/?q=go' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string }> }
    expect(body.count).toBe(2)
    expect(body.results.map(r => r.providerJobId).sort()).toEqual(['job-2', 'job-3'])
  })

  it('returns all jobs when q is empty', async () => {
    seedJob(db, JOB1)
    seedJob(db, JOB2)
    seedJob(db, JOB3)

    const res = await app.inject({ method: 'GET', url: '/?q=' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string }> }
    expect(body.count).toBe(3)
    expect(body.results).toHaveLength(3)
  })

  it('trims whitespace from q', async () => {
    seedJob(db, JOB1)
    seedJob(db, { ...JOB2, title: 'Go Developer' })

    const res = await app.inject({ method: 'GET', url: '/?q=%20%20go%20%20' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string }> }
    expect(body.count).toBe(1)
    expect(body.results[0].providerJobId).toBe('job-2')
  })
})
