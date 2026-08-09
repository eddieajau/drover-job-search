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

  it('is idempotent on conflict: resets topic and clears errorMessage', () => {
    const job = seedJob(db, JOB1)
    db.insert(analysisQueue).values({ jobId: job.id, topic: 'rank', errorMessage: 'previous failure' }).run()
    const publisher = createPublisher({ db })

    publisher.publish(job.id, 'fetch_job_details')

    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).get()!
    expect(row.topic).toBe('fetch_job_details')
    expect(row.errorMessage).toBeNull()
    expect(row.completedAt).toBeNull()
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
    db.insert(analysisQueue).values({ jobId: job.id, topic: 'rank', errorMessage: 'previous failure' }).run()
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
