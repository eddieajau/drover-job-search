/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobStatusEvents, type DB } from 'db'
import { build, createTestDb, JOB1, seedJob } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getApplicationsChart from './getApplicationsChart.js'

function toDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

describe('GET /api/applications/chart', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getApplicationsChart, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns 14 zero-count days for an empty database', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { days: Array<{ day: string; count: number }> }
    expect(body.days).toHaveLength(14)
    expect(body.days.every(d => d.count === 0)).toBe(true)
    expect(body.days[13].day).toBe(toDay(new Date()))
  })

  it('counts two applied events on the same day', async () => {
    const job = seedJob(db, JOB1)
    const today = toDay(new Date())
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: `${today}T10:00:00Z` })
      .run()
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: `${today}T14:00:00Z` })
      .run()

    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { days: Array<{ day: string; count: number }> }
    const todayEntry = body.days.find(d => d.day === today)
    expect(todayEntry?.count).toBe(2)
  })

  it('excludes events older than 14 days', async () => {
    const job = seedJob(db, JOB1)
    const old = new Date()
    old.setDate(old.getDate() - 30)
    const oldDay = toDay(old)
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'applied', occurredAt: `${oldDay}T10:00:00Z` })
      .run()

    const res = await app.inject({ method: 'GET', url: '/' })
    const body = res.json() as { days: Array<{ day: string; count: number }> }
    expect(body.days.every(d => d.count === 0)).toBe(true)
  })

  it('does not count non-applied statuses', async () => {
    const job = seedJob(db, JOB1)
    const today = toDay(new Date())
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'interviewing', occurredAt: `${today}T10:00:00Z` })
      .run()
    db.insert(jobStatusEvents)
      .values({ jobId: job.id, status: 'skipped', occurredAt: `${today}T12:00:00Z` })
      .run()

    const res = await app.inject({ method: 'GET', url: '/' })
    const body = res.json() as { days: Array<{ day: string; count: number }> }
    const todayEntry = body.days.find(d => d.day === today)
    expect(todayEntry?.count).toBe(0)
  })

  it('returns 7 days when ?days=7', async () => {
    const res = await app.inject({ method: 'GET', url: '/?days=7' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { days: Array<{ day: string; count: number }> }
    expect(body.days).toHaveLength(7)
    expect(body.days[6].day).toBe(toDay(new Date()))
  })

  it('returns 30 days when ?days=30', async () => {
    const res = await app.inject({ method: 'GET', url: '/?days=30' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { days: Array<{ day: string; count: number }> }
    expect(body.days).toHaveLength(30)
    expect(body.days[29].day).toBe(toDay(new Date()))
  })

  it('clamps ?days=100 to 30', async () => {
    const res = await app.inject({ method: 'GET', url: '/?days=100' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { days: Array<{ day: string; count: number }> }
    expect(body.days).toHaveLength(30)
  })

  it('defaults to 14 for non-numeric ?days', async () => {
    const res = await app.inject({ method: 'GET', url: '/?days=abc' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { days: Array<{ day: string; count: number }> }
    expect(body.days).toHaveLength(14)
  })

  it('clamps ?days=0 to 1', async () => {
    const res = await app.inject({ method: 'GET', url: '/?days=0' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { days: Array<{ day: string; count: number }> }
    expect(body.days).toHaveLength(1)
    expect(body.days[0].day).toBe(toDay(new Date()))
  })

  it('returns days in chronological order with last entry as today', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    const body = res.json() as { days: Array<{ day: string; count: number }> }
    expect(body.days).toHaveLength(14)
    const dayValues = body.days.map(d => d.day)
    expect(dayValues).toEqual([...dayValues].sort())
    expect(body.days[13].day).toBe(toDay(new Date()))
  })
})
