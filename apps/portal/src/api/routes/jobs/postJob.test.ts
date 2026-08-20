/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs, jobStatusEvents, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { build, createTestDb } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import postJob from './postJob.js'

const REQUIRED_FIELDS = {
  title: 'Staff Engineer',
  companyName: 'Acme Corp',
  location: 'Sydney, Australia',
  status: 'applied',
}

describe('POST /api/jobs', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(postJob, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns 400 when title is missing', async () => {
    const { title: _, ...payload } = REQUIRED_FIELDS
    const res = await app.inject({ method: 'POST', url: '/', payload })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when companyName is missing', async () => {
    const { companyName: _, ...payload } = REQUIRED_FIELDS
    const res = await app.inject({ method: 'POST', url: '/', payload })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when location is missing', async () => {
    const { location: _, ...payload } = REQUIRED_FIELDS
    const res = await app.inject({ method: 'POST', url: '/', payload })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when status is missing', async () => {
    const { status: _, ...payload } = REQUIRED_FIELDS
    const res = await app.inject({ method: 'POST', url: '/', payload })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when status is "new"', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: { ...REQUIRED_FIELDS, status: 'new' } })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when status is "discovered"', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: { ...REQUIRED_FIELDS, status: 'discovered' } })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for workplaceType not in enum', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { ...REQUIRED_FIELDS, workplaceType: 'office' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for employmentType not in enum', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { ...REQUIRED_FIELDS, employmentType: 'permanent' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for malformed at date', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { ...REQUIRED_FIELDS, at: 'not-a-date' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for malformed postedAt date', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { ...REQUIRED_FIELDS, postedAt: 'not-a-date' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 201 with required fields only', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: REQUIRED_FIELDS })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { id: number; status: string; title: string }
    expect(body.status).toBe('applied')
    expect(body.title).toBe('Staff Engineer')
    expect(body.id).toBeGreaterThan(0)
  })

  it('creates a job with provider manual and generated providerJobId', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: REQUIRED_FIELDS })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row).toBeDefined()
    expect(row?.provider).toBe('manual')
    expect(row?.providerJobId).toMatch(/^[0-9a-f]{32}$/)
    expect(row?.status).toBe('applied')
    expect(row?.title).toBe('Staff Engineer')
    expect(row?.companyName).toBe('Acme Corp')
    expect(row?.location).toBe('Sydney, Australia')
  })

  it('generates a synthetic url when none is provided', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: REQUIRED_FIELDS })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row?.url).toMatch(/^manual:\/\/[0-9a-f]{32}$/)
  })

  it('stores the provided url when given', async () => {
    const url = 'https://example.com/job/123'
    const res = await app.inject({ method: 'POST', url: '/', payload: { ...REQUIRED_FIELDS, url } })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row?.url).toBe(url)
  })

  it('returns 201 with all optional fields', async () => {
    const payload = {
      ...REQUIRED_FIELDS,
      url: 'https://example.com/job/999',
      workplaceType: 'hybrid',
      employmentType: 'contract',
      postedAt: '2026-03-01',
      description: 'A great role',
    }
    const res = await app.inject({ method: 'POST', url: '/', payload })
    expect(res.statusCode).toBe(201)
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row?.workplaceType).toBe('hybrid')
    expect(row?.employmentType).toBe('contract')
    expect(row?.postedAt).toBe('2026-03-01')
    expect(row?.description).toBe('A great role')
  })

  it('creates a job_status_events row with correct fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { ...REQUIRED_FIELDS, at: '2026-04-10' },
    })
    const { id } = res.json() as { id: number }
    const event = db.select().from(jobStatusEvents).where(eq(jobStatusEvents.jobId, id)).get()
    expect(event).toBeDefined()
    expect(event?.status).toBe('applied')
    expect(event?.occurredAt).toBe('2026-04-10')
    expect(event?.actor).toBe('human')
    expect(event?.note).toBeNull()
  })

  it('defaults occurred_at to today when at is not provided', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const res = await app.inject({ method: 'POST', url: '/', payload: REQUIRED_FIELDS })
    const { id } = res.json() as { id: number }
    const event = db.select().from(jobStatusEvents).where(eq(jobStatusEvents.jobId, id)).get()
    expect(event?.occurredAt).toBe(today)
  })

  it('sets closed_at for terminal statuses', async () => {
    for (const status of ['successful', 'unsuccessful', 'skipped'] as const) {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { ...REQUIRED_FIELDS, status, at: '2026-05-01' },
      })
      const { id } = res.json() as { id: number }
      const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
      expect(row?.closedAt).toBe('2026-05-01')
    }
  })

  it('does not set closed_at for non-terminal statuses', async () => {
    for (const status of ['applied', 'interviewing', 'blocked', 'declined'] as const) {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { ...REQUIRED_FIELDS, status, at: '2026-06-01' },
      })
      const { id } = res.json() as { id: number }
      const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
      expect(row?.closedAt).toBeNull()
    }
  })

  it('enqueues a rank entry in analysis_queue', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: REQUIRED_FIELDS })
    const { id } = res.json() as { id: number }
    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, id)).get()
    expect(row).toBeDefined()
    expect(row?.topic).toBe('rank')
    expect(row?.completedAt).toBeNull()
  })

  it('emits a kick with topic rank on the bus', async () => {
    let received: { topic: string } | undefined
    app.bus.on('kick', payload => {
      received = payload
    })

    await app.inject({ method: 'POST', url: '/', payload: REQUIRED_FIELDS })
    expect(received).toEqual({ topic: 'rank' })
  })
})
