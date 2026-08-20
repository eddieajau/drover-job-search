/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobStatusEvents, jobs, type DB } from 'db'
import { build, createTestDb, JOB1, seedJob } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { DashboardSummary } from '../../../../shared/types.js'
import getDashboardSummary from './getDashboardSummary.js'

function toDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

describe('GET /api/dashboard/summary', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getDashboardSummary, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns all zeros and empty attention for an empty database', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as DashboardSummary
    expect(body).toEqual({
      applied: { count: 0, delta: 0 },
      inFlight: { applied: 0, interviewing: 0 },
      interviewRate: 0,
      pipeline: { applied: 0, interviewing: 0, successful: 0, unsuccessful: 0, declined: 0 },
      attention: [],
    })
  })

  it('counts applied events in the window and excludes outside', async () => {
    const job = seedJob(db, JOB1)
    const inside = toDate(daysAgo(2))
    const outside = toDate(daysAgo(30))
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: `${inside}T10:00:00Z` })
      .run()
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: `${inside}T14:00:00Z` })
      .run()
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: `${inside}T18:00:00Z` })
      .run()
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: `${outside}T10:00:00Z` })
      .run()

    const res = await app.inject({ method: 'GET', url: '/' })
    const body = res.json() as DashboardSummary
    expect(body.applied.count).toBe(3)
  })

  it('computes applied.delta against prior window', async () => {
    const job = seedJob(db, JOB1)
    const now = daysAgo(2)
    const prior = daysAgo(16)
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: toDate(now) })
      .run()
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: toDate(now) })
      .run()
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: toDate(prior) })
      .run()
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: toDate(prior) })
      .run()
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: toDate(prior) })
      .run()

    const res = await app.inject({ method: 'GET', url: '/' })
    const body = res.json() as DashboardSummary
    expect(body.applied.count).toBe(2)
    expect(body.applied.delta).toBe(-1)
  })

  it('returns correct pipeline and inFlight counts', async () => {
    let seq = 0
    const makeJob = (status: string) =>
      db
        .insert(jobs)
        .values({ ...JOB1, provider: 'test', providerJobId: `j-${seq++}`, status })
        .returning()
        .get()

    makeJob('applied')
    makeJob('applied')
    makeJob('interviewing')
    makeJob('successful')
    makeJob('unsuccessful')
    makeJob('declined')

    const res = await app.inject({ method: 'GET', url: '/' })
    const body = res.json() as DashboardSummary
    expect(body.pipeline).toEqual({ applied: 2, interviewing: 1, successful: 1, unsuccessful: 1, declined: 1 })
    expect(body.inFlight).toEqual({ applied: 2, interviewing: 1 })
  })

  it('computes interviewRate as a percentage within the window', async () => {
    const job = seedJob(db, JOB1)
    const day = toDate(daysAgo(7))
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: `${day}T10:00:00Z` })
      .run()
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: `${day}T12:00:00Z` })
      .run()
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'interviewing', occurredAt: `${day}T14:00:00Z` })
      .run()

    const res = await app.inject({ method: 'GET', url: '/' })
    const body = res.json() as DashboardSummary
    expect(body.interviewRate).toBe(50)
  })

  it('includes discovered jobs missing details in attention', async () => {
    db.insert(jobs)
      .values({ ...JOB1, providerJobId: 'disc-1', status: 'discovered', description: null })
      .run()

    const res = await app.inject({ method: 'GET', url: '/' })
    const body = res.json() as DashboardSummary
    expect(body.attention).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'discovered_missing', message: '1 discovered job missing details' }),
      ])
    )
  })

  it('includes stuck queue items in attention', async () => {
    const job = seedJob(db, JOB1)
    const stuckAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    db.insert(analysisQueue).values({ jobId: job.id, topic: 'fetch_job_details', queuedAt: stuckAt }).run()

    const res = await app.inject({ method: 'GET', url: '/' })
    const body = res.json() as DashboardSummary
    expect(body.attention).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'queue_stuck', message: '1 queue item stuck (>24h)' })])
    )
  })

  it('respects ?days=7', async () => {
    const job = seedJob(db, JOB1)
    const inWindow = toDate(daysAgo(3))
    const outWindow = toDate(daysAgo(10))
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: `${inWindow}T10:00:00Z` })
      .run()
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: `${outWindow}T10:00:00Z` })
      .run()

    const res = await app.inject({ method: 'GET', url: '/?days=7' })
    const body = res.json() as DashboardSummary
    expect(body.applied.count).toBe(1)
  })
})
