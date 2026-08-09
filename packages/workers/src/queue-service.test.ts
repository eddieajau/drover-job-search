/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { createTestDb, JOB1, seedJob } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueueService } from './queue-service.js'

describe('createQueueService', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.$client.close()
  })

  it('inserts a row at topic fetch_job_details with null completedAt and errorMessage', () => {
    const job = seedJob(db, JOB1)
    const svc = createQueueService({ db })

    svc.fetchJobDetails(job.id)

    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).get()!
    expect(row.topic).toBe('fetch_job_details')
    expect(row.completedAt).toBeNull()
    expect(row.errorMessage).toBeNull()
  })

  it('resets topic and clears errorMessage on conflict', () => {
    const job = seedJob(db, JOB1)
    db.insert(analysisQueue).values({ jobId: job.id, topic: 'rank', errorMessage: 'previous failure' }).run()
    const svc = createQueueService({ db })

    svc.fetchJobDetails(job.id)

    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).get()!
    expect(row.topic).toBe('fetch_job_details')
    expect(row.errorMessage).toBeNull()
    expect(row.completedAt).toBeNull()
  })

  it('calls onEnqueue with (jobId, fetch_job_details) after insert', () => {
    const job = seedJob(db, JOB1)
    const onEnqueue = vi.fn()
    const svc = createQueueService({ db, onEnqueue })

    svc.fetchJobDetails(job.id)

    expect(onEnqueue).toHaveBeenCalledOnce()
    expect(onEnqueue).toHaveBeenCalledWith(job.id, 'fetch_job_details')
  })

  it('calls onEnqueue on the conflict path too', () => {
    const job = seedJob(db, JOB1)
    db.insert(analysisQueue).values({ jobId: job.id, topic: 'rank', errorMessage: 'previous failure' }).run()
    const onEnqueue = vi.fn()
    const svc = createQueueService({ db, onEnqueue })

    svc.fetchJobDetails(job.id)

    expect(onEnqueue).toHaveBeenCalledOnce()
    expect(onEnqueue).toHaveBeenCalledWith(job.id, 'fetch_job_details')
  })

  it('does not throw when onEnqueue is omitted', () => {
    const job = seedJob(db, JOB1)
    const svc = createQueueService({ db })

    expect(() => svc.fetchJobDetails(job.id)).not.toThrow()
  })
})
