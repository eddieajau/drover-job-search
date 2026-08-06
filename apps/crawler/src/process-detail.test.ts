/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, createDb, jobs } from 'db'
import { describe, it, expect } from 'vitest'

import { processDetailQueue, type DetailFn } from './process-detail.js'

function seedJob(db: ReturnType<typeof createDb>, providerJobId: string) {
  db.insert(jobs)
    .values({
      provider: 'linkedin',
      providerJobId,
      title: 'Test Job',
      companyName: 'Acme',
      url: 'https://example.com/1',
      location: 'Remote',
    })
    .run()
  const job = db.select().from(jobs).get()!
  db.insert(analysisQueue).values({ jobId: job.id }).run()
  return job
}

describe('processDetailQueue', () => {
  it('writes description and sets completed_at for pending rows', async () => {
    const db = createDb(':memory:')
    seedJob(db, '123456')

    const mockDetail: DetailFn = async () => ({ description: '<p>Full job description</p>' })

    const result = await processDetailQueue(db, mockDetail, 10)

    expect(result.processed).toBe(1)
    expect(result.failed).toBe(0)

    const job = db.select().from(jobs).get()!
    expect(job.description).toBe('Full job description')

    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()

    db.$client.close()
  })

  it('stores structured HTML as markdown', async () => {
    const db = createDb(':memory:')
    seedJob(db, '123456')

    const mockDetail: DetailFn = async () => ({
      description: '<h2>The Team</h2><ul><li>a</li><li>b</li></ul>',
    })

    const result = await processDetailQueue(db, mockDetail, 10)

    expect(result.processed).toBe(1)
    expect(result.failed).toBe(0)

    const job = db.select().from(jobs).get()!
    expect(job.description).toBe('## The Team\n\n-   a\n-   b')

    db.$client.close()
  })

  it('leaves row pending when detail returns null', async () => {
    const db = createDb(':memory:')
    seedJob(db, '123456')

    const mockDetail: DetailFn = async () => null

    const result = await processDetailQueue(db, mockDetail, 10)

    expect(result.processed).toBe(0)
    expect(result.failed).toBe(1)

    const job = db.select().from(jobs).get()!
    expect(job.description).toBeNull()

    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).toBeNull()

    db.$client.close()
  })

  it('leaves row pending when detail throws', async () => {
    const db = createDb(':memory:')
    seedJob(db, '123456')

    const mockDetail: DetailFn = async () => {
      throw new Error('network error')
    }

    const result = await processDetailQueue(db, mockDetail, 10)

    expect(result.processed).toBe(0)
    expect(result.failed).toBe(1)

    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).toBeNull()

    db.$client.close()
  })

  it('respects the limit parameter', async () => {
    const db = createDb(':memory:')

    for (const id of ['111111', '222222', '333333']) {
      db.insert(jobs)
        .values({
          provider: 'linkedin',
          providerJobId: id,
          title: 'Test Job',
          companyName: 'Acme',
          url: `https://example.com/${id}`,
          location: 'Remote',
        })
        .run()
      const job = db
        .select()
        .from(jobs)
        .where()
        .all()
        .find(j => j.providerJobId === id)!
      db.insert(analysisQueue).values({ jobId: job.id }).run()
    }

    const calls: string[] = []
    const mockDetail: DetailFn = async opts => {
      calls.push(opts.id)
      return { description: 'desc' }
    }

    const result = await processDetailQueue(db, mockDetail, 2)

    expect(result.processed).toBe(2)
    expect(calls).toHaveLength(2)

    const pending = db
      .select()
      .from(analysisQueue)
      .where()
      .all()
      .filter(q => q.completedAt === null)
    expect(pending).toHaveLength(1)

    db.$client.close()
  })
})
