/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { createTestDb, JOB1, seedJob } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPublisher } from './publisher.js'

describe('createPublisher', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.$client.close()
  })

  it('publishes a row at the requested topic with null completedAt and errorMessage', () => {
    const job = seedJob(db, JOB1)
    const publisher = createPublisher({ db })

    publisher.publish(job.id, 'fetch_job_details')

    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).get()!
    expect(row.topic).toBe('fetch_job_details')
    expect(row.completedAt).toBeNull()
    expect(row.errorMessage).toBeNull()
  })

  it('inserts a new row when publishing a different topic', () => {
    const job = seedJob(db, JOB1)
    db.insert(analysisQueue).values({ jobId: job.id, topic: 'rank', errorMessage: 'previous failure' }).run()
    const publisher = createPublisher({ db })

    publisher.publish(job.id, 'fetch_job_details')

    const rows = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).all()
    expect(rows).toHaveLength(2)

    const fetchRow = rows.find(r => r.topic === 'fetch_job_details')!
    expect(fetchRow.errorMessage).toBeNull()
    expect(fetchRow.completedAt).toBeNull()

    const rankRow = rows.find(r => r.topic === 'rank')!
    expect(rankRow.errorMessage).toBe('previous failure')
  })

  it('inserts a new row when publishing the same topic again (allows retries)', () => {
    const job = seedJob(db, JOB1)
    db.insert(analysisQueue)
      .values({
        jobId: job.id,
        topic: 'fetch_job_details',
        errorMessage: 'previous failure',
        completedAt: '2026-01-01',
      })
      .run()
    const publisher = createPublisher({ db })

    publisher.publish(job.id, 'fetch_job_details')

    const rows = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).all()
    expect(rows).toHaveLength(2)

    const newRow = rows.find(r => r.completedAt === null)!
    expect(newRow.topic).toBe('fetch_job_details')
    expect(newRow.errorMessage).toBeNull()

    const oldRow = rows.find(r => r.completedAt !== null)!
    expect(oldRow.errorMessage).toBe('previous failure')
  })

  it('publishes to any topic, including rank', () => {
    const job = seedJob(db, JOB1)
    const publisher = createPublisher({ db })

    publisher.publish(job.id, 'rank')

    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).get()!
    expect(row.topic).toBe('rank')
  })

  it('calls onEnqueue with (jobId, topic) after insert', () => {
    const job = seedJob(db, JOB1)
    const onEnqueue = vi.fn()
    const publisher = createPublisher({ db, onEnqueue })

    publisher.publish(job.id, 'fetch_job_details')

    expect(onEnqueue).toHaveBeenCalledOnce()
    expect(onEnqueue).toHaveBeenCalledWith(job.id, 'fetch_job_details')
  })

  it('calls onEnqueue on the conflict path too', () => {
    const job = seedJob(db, JOB1)
    db.insert(analysisQueue)
      .values({
        jobId: job.id,
        topic: 'fetch_job_details',
        errorMessage: 'previous failure',
        completedAt: '2026-01-01',
      })
      .run()
    const onEnqueue = vi.fn()
    const publisher = createPublisher({ db, onEnqueue })

    publisher.publish(job.id, 'fetch_job_details')

    expect(onEnqueue).toHaveBeenCalledOnce()
    expect(onEnqueue).toHaveBeenCalledWith(job.id, 'fetch_job_details')
  })

  it('does not throw when onEnqueue is omitted', () => {
    const job = seedJob(db, JOB1)
    const publisher = createPublisher({ db })

    expect(() => publisher.publish(job.id, 'rank')).not.toThrow()
  })
})
