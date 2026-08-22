/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, createDb, jobs, type DB } from 'db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { drainRows, type RowOutcome } from './drainQueue.js'

function seedQueue(db: DB, providerJobId: string) {
  db.insert(jobs)
    .values({
      provider: 'linkedin',
      providerJobId,
      title: 'Test Job',
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
  return db
    .select()
    .from(analysisQueue)
    .all()
    .find(q => q.jobId === job.id)!.id
}

describe('drainRows', () => {
  let db: ReturnType<typeof createDb>

  beforeEach(() => {
    db = createDb(':memory:')
  })

  afterEach(() => {
    db.$client.close()
  })

  it('processes pending rows in id order and tallies outcomes', async () => {
    const first = seedQueue(db, '111111')
    const second = seedQueue(db, '222222')
    const third = seedQueue(db, '333333')
    const outcomes = new Map<number, RowOutcome>([
      [first, 'written'],
      [second, 'skipped'],
      [third, 'failed'],
    ])

    const processed: number[] = []
    const tally = await drainRows(db, 'fetch_job_details', {
      processRow: async row => {
        processed.push(row.queueId)
        return outcomes.get(row.queueId)!
      },
    })

    expect(processed).toEqual([first, second, third])
    expect(tally).toEqual({ written: 1, skipped: 1, failed: 1 })
  })
})
