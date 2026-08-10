/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, createDb, jobs, type DB } from 'db'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConsumerOptions } from '../consumer.js'
import { createConsumer } from '../consumer.js'
import { createFetchJobDetailsConsumer, drain, drainOne, type DetailFn } from './fetchJobDetails.js'

const { consumerKickFn, consumerStopFn, consumerCaptured } = vi.hoisted(() => ({
  consumerKickFn: vi.fn(),
  consumerStopFn: vi.fn(),
  consumerCaptured: { opts: undefined as ConsumerOptions | undefined },
}))

vi.mock('../consumer.js', () => ({
  createConsumer: vi.fn((opts: ConsumerOptions) => {
    consumerCaptured.opts = opts
    return { kick: consumerKickFn, stop: consumerStopFn }
  }),
}))

function seedQueue(db: DB, providerJobId: string, topic: 'fetch_job_details' | 'rank' = 'fetch_job_details') {
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
  db.insert(analysisQueue).values({ jobId: job.id, topic }).run()
  const queue = db
    .select()
    .from(analysisQueue)
    .all()
    .find(q => q.jobId === job.id)!
  return { jobId: job.id, queueId: queue.id }
}

describe('fetch-job-details drain', () => {
  let db: ReturnType<typeof createDb>

  beforeEach(() => {
    db = createDb(':memory:')
  })

  afterEach(() => {
    db.$client.close()
  })

  it('writes markdown and advances the row to rank', async () => {
    seedQueue(db, '123456')
    const onProgress = vi.fn()

    const result = await drain(db, {
      detailFn: async () => ({ description: '<h2>The Team</h2><ul><li>a</li><li>b</li></ul>' }),
      onProgress,
    })

    expect(result).toEqual({ processed: 1, failed: 0 })
    const job = db.select().from(jobs).get()!
    expect(job.description).toBe('## The Team\n\n-   a\n-   b')

    const rows = db.select().from(analysisQueue).all()
    expect(rows).toHaveLength(2)

    const fetchRow = rows.find(r => r.topic === 'fetch_job_details')!
    expect(fetchRow.completedAt).not.toBeNull()

    const rankRow = rows.find(r => r.topic === 'rank')!
    expect(rankRow.completedAt).toBeNull()

    expect(onProgress).toHaveBeenCalledTimes(1)
  })

  it('marks the row done when detail returns null', async () => {
    seedQueue(db, '123456')
    const onError = vi.fn()

    const result = await drain(db, { detailFn: async () => null, onError })

    expect(result).toEqual({ processed: 0, failed: 1 })
    const job = db.select().from(jobs).get()!
    expect(job.description).toBeNull()

    const queue = db.select().from(analysisQueue).get()!
    expect(queue.topic).toBe('fetch_job_details')
    expect(queue.completedAt).not.toBeNull()
    expect(queue.errorMessage).toBe('no description')
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][1]).toBeNull()
  })

  it('marks the row done when detail throws', async () => {
    seedQueue(db, '123456')
    const onError = vi.fn()
    const error = new Error('network error')

    const result = await drain(db, {
      detailFn: async () => {
        throw error
      },
      onError,
    })

    expect(result).toEqual({ processed: 0, failed: 1 })
    const job = db.select().from(jobs).get()!
    expect(job.description).toBeNull()

    const queue = db.select().from(analysisQueue).get()!
    expect(queue.topic).toBe('fetch_job_details')
    expect(queue.completedAt).not.toBeNull()
    expect(queue.errorMessage).toBe('network error')
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][1]).toBe(error)
  })

  it('does not re-drain a row already failed on a previous pass', async () => {
    seedQueue(db, '123456')
    const detailFn = vi.fn<DetailFn>(async () => null)

    await drain(db, { detailFn })
    await drain(db, { detailFn })

    expect(detailFn).toHaveBeenCalledTimes(1)
    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()
  })

  it('respects the limit', async () => {
    for (const id of ['111111', '222222', '333333']) {
      seedQueue(db, id)
    }

    const calls: string[] = []
    const detailFn: DetailFn = async opts => {
      calls.push(opts.id)
      return { description: 'desc' }
    }

    const result = await drain(db, { detailFn, limit: 2 })

    expect(result).toEqual({ processed: 2, failed: 0 })
    expect(calls).toHaveLength(2)

    const pending = db
      .select()
      .from(analysisQueue)
      .all()
      .filter(q => q.topic === 'fetch_job_details' && q.completedAt === null)
    expect(pending).toHaveLength(1)
  })

  it('does not pick up rows already at topic rank', async () => {
    seedQueue(db, '123456', 'rank')
    const detailFn = vi.fn<DetailFn>(async () => ({ description: 'desc' }))

    const result = await drain(db, { detailFn })

    expect(result).toEqual({ processed: 0, failed: 0 })
    expect(detailFn).not.toHaveBeenCalled()
  })

  it('drainOne writes a single row by queue id', async () => {
    const { queueId } = seedQueue(db, '123456')
    const detailFn = vi.fn<DetailFn>(async () => ({ description: 'desc' }))

    const outcome = await drainOne(db, queueId, { detailFn })

    expect(outcome).toBe('written')
    expect(detailFn).toHaveBeenCalledWith({ id: '123456' })
    const rows = db.select().from(analysisQueue).all()
    expect(rows).toHaveLength(2)
    const rankRow = rows.find(r => r.topic === 'rank')!
    expect(rankRow.completedAt).toBeNull()
  })

  it('drainOne fails a row when detail throws', async () => {
    const { queueId } = seedQueue(db, '123456')

    const outcome = await drainOne(db, queueId, {
      detailFn: async () => {
        throw new Error('network error')
      },
    })

    expect(outcome).toBe('failed')
    const queue = db.select().from(analysisQueue).get()!
    expect(queue.errorMessage).toBe('network error')
    expect(queue.topic).toBe('fetch_job_details')
    expect(queue.completedAt).not.toBeNull()
  })

  it('drainOne returns failed for an unknown queue id', async () => {
    const outcome = await drainOne(db, 999, { detailFn: async () => ({ description: 'desc' }) })

    expect(outcome).toBe('failed')
  })
})

describe('createFetchJobDetailsConsumer', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  beforeEach(() => {
    consumerKickFn.mockClear()
    consumerStopFn.mockClear()
    consumerCaptured.opts = undefined
  })

  it('returns a Consumer delegating kick/stop to createConsumer', () => {
    const db = createDb(':memory:')
    const consumer = createFetchJobDetailsConsumer({ db, log, detailFn: async () => null })

    consumer.kick()
    consumer.stop()

    expect(consumerKickFn).toHaveBeenCalledTimes(1)
    expect(consumerStopFn).toHaveBeenCalledTimes(1)
    expect(createConsumer).toHaveBeenCalledWith(expect.objectContaining({ topic: 'fetch_job_details' }))
    db.$client.close()
  })

  it('onDrained fires through the consumer onEmpty', () => {
    const db = createDb(':memory:')
    const onDrained = vi.fn()
    createFetchJobDetailsConsumer({ db, log, detailFn: async () => null, onDrained })

    consumerCaptured.opts?.onEmpty?.()

    expect(onDrained).toHaveBeenCalledOnce()
    db.$client.close()
  })

  it('drain processes pending rows through fetchJobDetails.drain', async () => {
    const db = createDb(':memory:')
    seedQueue(db, '123456')
    const detailFn = vi.fn<DetailFn>(async () => ({ description: 'A description' }))
    createFetchJobDetailsConsumer({ db, log, detailFn })

    const result = await consumerCaptured.opts?.drain()

    expect(result).toEqual({ total: 1 })
    expect(detailFn).toHaveBeenCalledWith({ id: '123456' })
    const job = db.select().from(jobs).get()!
    expect(job.description).toBe('A description')
    expect(log.info).toHaveBeenCalledWith({ providerJobId: '123456' }, 'description saved')
    db.$client.close()
  })
})
