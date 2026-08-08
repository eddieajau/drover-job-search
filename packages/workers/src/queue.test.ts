/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, createDb, jobs, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { advanceTo, complete, fail, selectPending } from './queue.js'

describe('queue helpers', () => {
  let db: ReturnType<typeof createDb>

  beforeEach(() => {
    db = createDb(':memory:')
  })

  afterEach(() => {
    db.$client.close()
  })

  function seedJob(db: DB, providerJobId: string): number {
    db.insert(jobs)
      .values({
        provider: 'linkedin',
        providerJobId,
        title: `Job ${providerJobId}`,
        companyName: 'Acme',
        url: `https://example.com/${providerJobId}`,
        location: 'Remote',
      })
      .run()
    const job = db
      .select()
      .from(jobs)
      .all()
      .find(j => j.providerJobId === providerJobId)!
    db.insert(analysisQueue).values({ jobId: job.id, stage: 'fetch_job_details' }).run()
    return job.id
  }

  describe('selectPending', () => {
    it('selects rows for the requested stage with completed_at null', () => {
      const a = seedJob(db, 'a')
      const b = seedJob(db, 'b')
      const c = seedJob(db, 'c')
      db.update(analysisQueue).set({ stage: 'rank' }).where(eq(analysisQueue.jobId, c)).run()
      db.update(analysisQueue).set({ completedAt: '2026-01-01' }).where(eq(analysisQueue.jobId, a)).run()

      const rows = selectPending(db, 'fetch_job_details')

      expect(rows).toHaveLength(1)
      expect(rows[0]).toEqual({
        queueId: expect.any(Number),
        jobId: b,
        providerJobId: 'b',
        title: 'Job b',
      })
    })

    it('orders by queue id', () => {
      seedJob(db, 'first')
      seedJob(db, 'second')

      const rows = selectPending(db, 'fetch_job_details')

      expect(rows.map(r => r.providerJobId)).toEqual(['first', 'second'])
    })

    it('caps rows when a limit is given', () => {
      seedJob(db, 'first')
      seedJob(db, 'second')

      const rows = selectPending(db, 'fetch_job_details', 1)

      expect(rows).toHaveLength(1)
      expect(rows[0].providerJobId).toBe('first')
    })
  })

  describe('advanceTo', () => {
    it('sets the next stage and re-arms completed_at and error_message', () => {
      const jobId = seedJob(db, 'a')
      db.update(analysisQueue).set({ errorMessage: 'previous failure' }).where(eq(analysisQueue.jobId, jobId)).run()

      const row = db.select().from(analysisQueue).get()!
      advanceTo(db, row.id, 'rank')

      const updated = db.select().from(analysisQueue).get()!
      expect(updated.stage).toBe('rank')
      expect(updated.completedAt).toBeNull()
      expect(updated.errorMessage).toBeNull()
    })
  })

  describe('complete', () => {
    it('stamps completed_at and clears error_message', () => {
      const jobId = seedJob(db, 'a')
      db.update(analysisQueue).set({ errorMessage: 'boom' }).where(eq(analysisQueue.jobId, jobId)).run()

      const row = db.select().from(analysisQueue).get()!
      complete(db, row.id)

      const updated = db.select().from(analysisQueue).get()!
      expect(updated.completedAt).not.toBeNull()
      expect(updated.errorMessage).toBeNull()
    })
  })

  describe('fail', () => {
    it('records error_message, stamps completed_at, and leaves stage untouched', () => {
      seedJob(db, 'a')

      const row = db.select().from(analysisQueue).get()!
      fail(db, row.id, 'no description')

      const updated = db.select().from(analysisQueue).get()!
      expect(updated.errorMessage).toBe('no description')
      expect(updated.completedAt).not.toBeNull()
      expect(updated.stage).toBe('fetch_job_details')
    })

    it('removes the row from the pending set', () => {
      seedJob(db, 'a')

      const row = db.select().from(analysisQueue).get()!
      fail(db, row.id, 'boom')

      const pending = selectPending(db, 'fetch_job_details')
      expect(pending).toHaveLength(0)
    })
  })
})
