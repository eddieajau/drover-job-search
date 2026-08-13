/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, createDb, jobs, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { complete, completeAndAdvance, fail, selectPending } from './queue.js'

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
    db.insert(analysisQueue).values({ jobId: job.id, topic: 'fetch_job_details' }).run()
    return job.id
  }

  describe('selectPending', () => {
    it('selects rows for the requested topic with completed_at null', () => {
      const a = seedJob(db, 'a')
      const b = seedJob(db, 'b')
      const c = seedJob(db, 'c')
      db.update(analysisQueue).set({ topic: 'rank' }).where(eq(analysisQueue.jobId, c)).run()
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

    it('returns a sweep row for run_signal_rules with sentinel job fields', () => {
      db.insert(analysisQueue).values({ jobId: null, topic: 'run_signal_rules' }).run()

      const rows = selectPending(db, 'run_signal_rules')

      expect(rows).toHaveLength(1)
      expect(rows[0]).toEqual({ queueId: expect.any(Number), jobId: 0, providerJobId: '', title: '' })
    })

    it('does not return completed run_signal_rules rows', () => {
      db.insert(analysisQueue).values({ jobId: null, topic: 'run_signal_rules', completedAt: '2026-01-01' }).run()

      const rows = selectPending(db, 'run_signal_rules')

      expect(rows).toHaveLength(0)
    })
  })

  describe('completeAndAdvance', () => {
    it('completes the current row and inserts a new row with the next topic', () => {
      const jobId = seedJob(db, 'a')
      db.update(analysisQueue).set({ errorMessage: 'previous failure' }).where(eq(analysisQueue.jobId, jobId)).run()

      const row = db.select().from(analysisQueue).get()!
      completeAndAdvance(db, row.id, 'rank')

      const rows = db.select().from(analysisQueue).all()
      expect(rows).toHaveLength(2)

      const completed = rows.find(r => r.id === row.id)!
      expect(completed.topic).toBe('fetch_job_details')
      expect(completed.completedAt).not.toBeNull()
      expect(completed.errorMessage).toBeNull()

      const advanced = rows.find(r => r.id !== row.id)!
      expect(advanced.topic).toBe('rank')
      expect(advanced.completedAt).toBeNull()
      expect(advanced.errorMessage).toBeNull()
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
    it('records error_message, stamps completed_at, and leaves topic untouched', () => {
      seedJob(db, 'a')

      const row = db.select().from(analysisQueue).get()!
      fail(db, row.id, 'no description')

      const updated = db.select().from(analysisQueue).get()!
      expect(updated.errorMessage).toBe('no description')
      expect(updated.completedAt).not.toBeNull()
      expect(updated.topic).toBe('fetch_job_details')
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
