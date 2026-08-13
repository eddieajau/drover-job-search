/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, createDb, jobSignals, jobs, signalRules, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConsumerOptions } from '../consumer.js'
import { createConsumer } from '../consumer.js'
import { createRunSignalRulesConsumer, drainSweep } from './runSignalRules.js'

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

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

function seedJob(db: DB, providerJobId: string, title: string, status = 'new'): number {
  db.insert(jobs)
    .values({
      provider: 'linkedin',
      providerJobId,
      title,
      companyName: 'Acme',
      url: `https://example.com/${providerJobId}`,
      location: 'Remote',
      status,
    })
    .run()
  return db
    .select()
    .from(jobs)
    .all()
    .find(j => j.providerJobId === providerJobId)!.id
}

function seedDealbreakerRule(db: DB, pattern: string, enabled = true): void {
  db.insert(signalRules)
    .values({
      ruleName: `rule-${pattern}`,
      ruleCategory: 'regex_title',
      pattern,
      signalType: 'dealbreaker',
      enabled,
    })
    .run()
}

function seedSweepRow(db: DB): number {
  db.insert(analysisQueue).values({ jobId: null, topic: 'run_signal_rules' }).run()
  return db.select().from(analysisQueue).get()!.id
}

function seedLlmDealbreaker(db: DB, jobId: number): void {
  db.insert(jobSignals)
    .values({
      jobId,
      ruleId: null,
      source: 'llm_deep_eval',
      signalType: 'dealbreaker',
      score: -100,
      metadata: JSON.stringify({ gate: 'eligibility', reason: 'test' }),
    })
    .run()
}

describe('runSignalRules drainSweep', () => {
  let db: ReturnType<typeof createDb>

  beforeEach(() => {
    db = createDb(':memory:')
  })

  afterEach(() => {
    db.$client.close()
  })

  it('runs enabled regex rules then flips matching new jobs to blocked and completes the row', async () => {
    const matchId = seedJob(db, 'matching', 'Senior Java Developer')
    const nonMatchId = seedJob(db, 'non-matching', 'Frontend Engineer')
    seedDealbreakerRule(db, '(?i)\\bjava\\b')
    seedDealbreakerRule(db, '(?i)\\bnosuchterm\\b')
    const queueId = seedSweepRow(db)

    const result = await drainSweep(db, log)

    expect(result).toEqual({ written: 1, skipped: 0 })

    const queue = db.select().from(analysisQueue).where(eq(analysisQueue.id, queueId)).get()!
    expect(queue.completedAt).not.toBeNull()

    expect(db.select().from(jobs).where(eq(jobs.id, matchId)).get()!.status).toBe('blocked')
    expect(db.select().from(jobs).where(eq(jobs.id, nonMatchId)).get()!.status).toBe('new')
  })

  it('flips a blocked job back to new when its dealbreaker rows are removed', async () => {
    const jobId = seedJob(db, 'matching', 'Senior Java Developer', 'blocked')
    seedDealbreakerRule(db, '(?i)\\bjava\\b')
    seedSweepRow(db)
    await drainSweep(db, log)
    expect(db.select().from(jobs).where(eq(jobs.id, jobId)).get()!.status).toBe('blocked')

    db.update(signalRules).set({ pattern: '(?i)\\bpython\\b' }).run()
    db.update(analysisQueue).set({ completedAt: null }).run()
    await drainSweep(db, log)

    expect(db.select().from(jobs).where(eq(jobs.id, jobId)).get()!.status).toBe('new')
  })

  it('does not change the status of discovered/applied/skipped jobs with dealbreaker signals', async () => {
    const statuses: { status: string; jobId: number }[] = []
    for (const status of ['discovered', 'applied', 'skipped']) {
      const jobId = seedJob(db, `job-${status}`, 'A role')
      db.update(jobs).set({ status }).where(eq(jobs.id, jobId)).run()
      seedLlmDealbreaker(db, jobId)
      statuses.push({ status, jobId })
    }
    seedSweepRow(db)

    await drainSweep(db, log)

    for (const { status, jobId } of statuses) {
      expect(db.select().from(jobs).where(eq(jobs.id, jobId)).get()!.status).toBe(status)
    }
  })

  it('picks up an llm_deep_eval dealbreaker for a new job and flips it to blocked', async () => {
    const jobId = seedJob(db, 'llm-blocked', 'Senior Java Developer')
    seedLlmDealbreaker(db, jobId)
    seedSweepRow(db)

    await drainSweep(db, log)

    expect(db.select().from(jobs).where(eq(jobs.id, jobId)).get()!.status).toBe('blocked')
  })

  it('flips a blocked job back to new when its llm_deep_eval dealbreaker rows are removed', async () => {
    const jobId = seedJob(db, 'llm-unblocked', 'Senior Java Developer', 'blocked')
    seedLlmDealbreaker(db, jobId)
    seedSweepRow(db)
    await drainSweep(db, log)
    expect(db.select().from(jobs).where(eq(jobs.id, jobId)).get()!.status).toBe('blocked')

    db.delete(jobSignals).run()
    db.update(analysisQueue).set({ completedAt: null }).run()
    await drainSweep(db, log)

    expect(db.select().from(jobs).where(eq(jobs.id, jobId)).get()!.status).toBe('new')
  })

  it('completes each pending sweep row', async () => {
    seedSweepRow(db)
    seedSweepRow(db)

    const result = await drainSweep(db, log)

    expect(result).toEqual({ written: 2, skipped: 0 })
    const pending = db
      .select()
      .from(analysisQueue)
      .all()
      .filter(q => q.completedAt === null)
    expect(pending).toHaveLength(0)
  })
})

describe('createRunSignalRulesConsumer', () => {
  beforeEach(() => {
    consumerKickFn.mockClear()
    consumerStopFn.mockClear()
    consumerCaptured.opts = undefined
    log.debug.mockClear()
  })

  it('returns a Consumer delegating kick/stop to createConsumer', () => {
    const db = createDb(':memory:')
    const consumer = createRunSignalRulesConsumer({ db, log })

    consumer.kick()
    consumer.stop()

    expect(consumerKickFn).toHaveBeenCalledTimes(1)
    expect(consumerStopFn).toHaveBeenCalledTimes(1)
    expect(createConsumer).toHaveBeenCalledWith(expect.objectContaining({ topic: 'run_signal_rules' }))
    db.$client.close()
  })

  it('drain runs the sweep and reports the processed total', async () => {
    const db = createDb(':memory:')
    seedJob(db, 'matching', 'Senior Java Developer')
    seedDealbreakerRule(db, '(?i)\\bjava\\b')
    seedSweepRow(db)
    createRunSignalRulesConsumer({ db, log })

    const result = await consumerCaptured.opts?.drain()

    expect(result).toEqual({ total: 1 })
    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()
    db.$client.close()
  })
})
