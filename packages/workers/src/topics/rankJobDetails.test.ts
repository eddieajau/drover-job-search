/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, createDb, facts, jobSignals, jobs, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { seedFact } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createOllamaClient } from '../clients/ollama.js'
import type { OllamaClient } from '../clients/ollama.js'
import type { ConsumerOptions } from '../consumer.js'
import { createConsumer } from '../consumer.js'
import { createRankConsumer, drain, drainOne } from './rankJobDetails.js'

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

const mockOllama = { generate: vi.fn() }
vi.mock('../clients/ollama.js', () => ({
  createOllamaClient: vi.fn(() => mockOllama),
}))

function seedQueue(
  db: DB,
  providerJobId: string,
  description: string | null = 'A great job',
  topic: 'fetch_job_details' | 'rank' = 'rank'
) {
  db.insert(jobs)
    .values({
      provider: 'linkedin',
      providerJobId,
      title: 'Test Job',
      companyName: 'Acme',
      url: `https://example.com/${providerJobId}`,
      location: 'Remote',
      description,
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

const documentedResponse = JSON.stringify({
  gates: [
    { name: 'eligibility', passed: true, score: 0, reason: 'Australian citizen with full working rights.' },
    { name: 'language', passed: true, score: 0, reason: 'English required and sufficient.' },
    { name: 'location', passed: false, score: -100, reason: 'Role requires relocation to Sydney.' },
  ],
  dimensions: [
    {
      name: 'technical',
      signal_type: 'skill_match',
      score: 75,
      matched_keywords: ['TypeScript', 'Node.js'],
      reason: 'Strong technical match.',
    },
    {
      name: 'experience',
      signal_type: 'skill_match',
      score: 62,
      matched_keywords: ['microservices'],
      reason: 'Deep backend experience.',
    },
    {
      name: 'behavioral',
      signal_type: 'company_match',
      score: 50,
      matched_keywords: ['greenfield'],
      reason: 'Moderate culture fit.',
    },
    {
      name: 'career',
      signal_type: 'company_match',
      score: 85,
      matched_keywords: ['staff engineer'],
      reason: 'Aligned career path.',
    },
  ],
})

describe('rank-job-details drain', () => {
  let db: ReturnType<typeof createDb>

  beforeEach(() => {
    db = createDb(':memory:')
  })

  afterEach(() => {
    db.$client.close()
  })

  function mockClient(response: string): OllamaClient {
    return { generate: async () => response }
  }

  it('writes signals, completes the row and calls onProgress', async () => {
    const { jobId } = seedQueue(db, '123456')
    const onProgress = vi.fn()

    const result = await drain(db, { client: mockClient(documentedResponse), onProgress })

    expect(result).toEqual({ written: 1, skipped: 0 })

    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(5)
    expect(signals.every(s => s.jobId === jobId)).toBe(true)

    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()
    expect(queue.errorMessage).toBeNull()
    expect(onProgress).toHaveBeenCalledTimes(1)
  })

  it('passes the active facts into the prompt for each evaluated job', async () => {
    seedQueue(db, '123456')
    seedFact(db, { category: 'constraint', label: 'Open to remote; based in Australia', confidence: 'stated' })
    seedFact(db, { category: 'skill', label: 'TypeScript', period: '10 yrs', confidence: 'stated' })
    seedFact(db, { category: 'skill', label: 'Kafka', confidence: 'inferred' })
    seedFact(db, { category: 'skill', label: 'COBOL', confidence: 'stretch' })
    seedFact(db, { category: 'skill', label: 'Retired skill', active: false })

    const generate = vi.fn(async () => documentedResponse)
    const result = await drain(db, { client: { generate } })

    expect(result).toEqual({ written: 1, skipped: 0 })
    expect(generate).toHaveBeenCalledOnce()
    const prompt = generate.mock.calls[0][0] as string
    expect(prompt).toContain('Candidate profile (derived from facts):')
    expect(prompt).toContain('- Open to remote; based in Australia')
    expect(prompt).toContain('- TypeScript — 10 yrs')
    expect(prompt).toContain('- (inferred from resume) Kafka')
    expect(prompt).not.toContain('COBOL')
    expect(prompt).not.toContain('Retired skill')
  })

  it('only reads active facts once per drain', async () => {
    for (const id of ['111111', '222222']) {
      seedQueue(db, id)
    }
    seedFact(db, { category: 'skill', label: 'TypeScript', confidence: 'stated' })

    const generate = vi.fn(async () => documentedResponse)
    await drain(db, { client: { generate } })

    expect(generate).toHaveBeenCalledTimes(2)
    for (const call of generate.mock.calls) {
      expect(call[0]).toContain('- TypeScript')
    }
    expect(db.select().from(facts).all()).toHaveLength(1)
  })

  it('writes one dealbreaker per failed gate and one signal per dimension', async () => {
    const { jobId } = seedQueue(db, '123456')

    const result = await drain(db, { client: mockClient(documentedResponse) })
    expect(result).toEqual({ written: 1, skipped: 0 })

    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(5)
    expect(signals.every(s => s.source === 'llm_deep_eval')).toBe(true)
    expect(signals.every(s => s.ruleId === null)).toBe(true)

    const gateSignal = signals.find(s => s.signalType === 'dealbreaker')!
    expect(gateSignal.jobId).toBe(jobId)
    expect(gateSignal.score).toBe(-100)
    expect(JSON.parse(gateSignal.metadata!)).toEqual({
      gate: 'location',
      reason: 'Role requires relocation to Sydney.',
    })

    const technical = signals.find(s => s.metadata?.includes('"dimension":"technical"'))!
    expect(technical.signalType).toBe('skill_match')
    expect(technical.score).toBe(75)
    expect(JSON.parse(technical.metadata!)).toEqual({
      dimension: 'technical',
      matched_keywords: ['TypeScript', 'Node.js'],
      reason: 'Strong technical match.',
    })
  })

  it('clamps dimension score to 0..100', async () => {
    seedQueue(db, '123456')

    const response = JSON.stringify({
      gates: [],
      dimensions: [{ name: 'technical', signal_type: 'skill_match', score: 999, matched_keywords: [], reason: 'test' }],
    })

    await drain(db, { client: mockClient(response) })

    const signal = db.select().from(jobSignals).get()!
    expect(signal.score).toBe(100)
  })

  it('defaults a failed gate score to -100 when omitted', async () => {
    seedQueue(db, '123456')

    const response = JSON.stringify({
      gates: [{ name: 'language', passed: false, reason: 'Non-English required.' }],
      dimensions: [],
    })

    await drain(db, { client: mockClient(response) })

    const signal = db.select().from(jobSignals).get()!
    expect(signal.signalType).toBe('dealbreaker')
    expect(signal.score).toBe(-100)
    expect(JSON.parse(signal.metadata!)).toEqual({ gate: 'language', reason: 'Non-English required.' })
  })

  it('writes no signals when all gates pass but still completes the row', async () => {
    seedQueue(db, '123456')
    const onProgress = vi.fn()

    const response = JSON.stringify({
      gates: [
        { name: 'eligibility', passed: true, score: 0, reason: 'ok' },
        { name: 'language', passed: true, score: 0, reason: 'ok' },
        { name: 'location', passed: true, score: 0, reason: 'ok' },
      ],
      dimensions: [],
    })

    const result = await drain(db, { client: mockClient(response), onProgress })

    expect(result).toEqual({ written: 1, skipped: 0 })
    expect(db.select().from(jobSignals).all()).toHaveLength(0)

    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()
    expect(onProgress).toHaveBeenCalledTimes(1)
  })

  it('marks the row done when LLM returns malformed JSON and calls onError', async () => {
    seedQueue(db, '123456')
    const onError = vi.fn()

    const result = await drain(db, { client: mockClient('not json'), onError })

    expect(result).toEqual({ written: 0, skipped: 1 })
    expect(db.select().from(jobSignals).all()).toHaveLength(0)

    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][1]).toBeInstanceOf(Error)
  })

  it('marks the row done when LLM response has wrong shape', async () => {
    seedQueue(db, '123456')
    const onError = vi.fn()

    const response = JSON.stringify({ score: 'not a number', signal_type: 'skill_match' })
    const result = await drain(db, { client: mockClient(response), onError })
    expect(result).toEqual({ written: 0, skipped: 1 })

    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('marks the row done when a gate name is invalid', async () => {
    seedQueue(db, '123456')
    const onError = vi.fn()

    const response = JSON.stringify({
      gates: [{ name: 'salary', passed: false }],
      dimensions: [],
    })
    const result = await drain(db, { client: mockClient(response), onError })
    expect(result).toEqual({ written: 0, skipped: 1 })

    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('marks the row done when dimension signal_type is invalid', async () => {
    seedQueue(db, '123456')
    const onError = vi.fn()

    const response = JSON.stringify({
      gates: [],
      dimensions: [{ name: 'technical', signal_type: 'invalid_type', score: 50, matched_keywords: [], reason: 'test' }],
    })
    const result = await drain(db, { client: mockClient(response), onError })
    expect(result).toEqual({ written: 0, skipped: 1 })

    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('marks the row done when ollama client throws and calls onError with the error', async () => {
    seedQueue(db, '123456')
    const onError = vi.fn()
    const error = new Error('network error')

    const result = await drain(db, {
      client: { generate: async () => Promise.reject(error) },
      onError,
    })
    expect(result).toEqual({ written: 0, skipped: 1 })

    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][1]).toBe(error)
  })

  it('marks the row done when the job has no description', async () => {
    seedQueue(db, '123456', null)
    const onError = vi.fn()

    const result = await drain(db, { client: mockClient('{}'), onError })
    expect(result).toEqual({ written: 0, skipped: 1 })

    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('replaces existing llm_deep_eval signals for same job', async () => {
    const { queueId } = seedQueue(db, '123456')

    await drain(db, { client: mockClient(documentedResponse) })
    db.update(analysisQueue).set({ completedAt: null }).where(eq(analysisQueue.id, queueId)).run()

    const second = JSON.stringify({
      gates: [],
      dimensions: [
        { name: 'career', signal_type: 'company_match', score: 40, matched_keywords: ['new'], reason: 'second eval' },
      ],
    })
    await drain(db, { client: mockClient(second) })

    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(1)
    expect(signals[0].score).toBe(40)
    expect(signals[0].signalType).toBe('company_match')
    expect(JSON.parse(signals[0].metadata!)).toEqual({
      dimension: 'career',
      matched_keywords: ['new'],
      reason: 'second eval',
    })
  })

  it('respects the limit', async () => {
    for (const id of ['111111', '222222', '333333']) {
      seedQueue(db, id)
    }

    const generate = vi.fn(async () => documentedResponse)
    const result = await drain(db, { client: { generate }, limit: 2 })

    expect(result).toEqual({ written: 2, skipped: 0 })
    expect(generate).toHaveBeenCalledTimes(2)

    const pending = db
      .select()
      .from(analysisQueue)
      .all()
      .filter(q => q.completedAt === null)
    expect(pending).toHaveLength(1)
  })

  it('does not pick up rows still at topic fetch_job_details', async () => {
    seedQueue(db, '123456', 'A great job', 'fetch_job_details')
    const generate = vi.fn(async () => documentedResponse)

    const result = await drain(db, { client: { generate } })

    expect(result).toEqual({ written: 0, skipped: 0 })
    expect(generate).not.toHaveBeenCalled()
  })

  it('drainOne writes a single row by queue id', async () => {
    const { queueId } = seedQueue(db, '123456')
    const onProgress = vi.fn()

    const outcome = await drainOne(db, queueId, { client: mockClient(documentedResponse), onProgress })

    expect(outcome).toBe('written')
    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()
    expect(onProgress).toHaveBeenCalledTimes(1)
  })

  it('drainOne marks a row skipped when generate throws', async () => {
    const { queueId } = seedQueue(db, '123456')
    const onError = vi.fn()

    const outcome = await drainOne(db, queueId, {
      client: { generate: async () => Promise.reject(new Error('network error')) },
      onError,
    })

    expect(outcome).toBe('skipped')
    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('drainOne returns skipped for an unknown queue id', async () => {
    const outcome = await drainOne(db, 999, { client: mockClient('{}') })

    expect(outcome).toBe('skipped')
  })
})

describe('createRankConsumer', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  beforeEach(() => {
    consumerKickFn.mockClear()
    consumerStopFn.mockClear()
    consumerCaptured.opts = undefined
    vi.mocked(createOllamaClient).mockClear()
    mockOllama.generate.mockReset()
  })

  it('returns a Consumer delegating kick/stop to createConsumer', () => {
    const db = createDb(':memory:')
    const consumer = createRankConsumer({ db, log })

    consumer.kick()
    consumer.stop()

    expect(consumerKickFn).toHaveBeenCalledTimes(1)
    expect(consumerStopFn).toHaveBeenCalledTimes(1)
    expect(createConsumer).toHaveBeenCalledWith(expect.objectContaining({ topic: 'rank' }))
    db.$client.close()
  })

  it('builds the ollama client from the supplied base URL and model', () => {
    const db = createDb(':memory:')
    createRankConsumer({ db, log, ollamaBaseUrl: 'http://custom:1234', ollamaModel: 'mistral' })

    expect(createOllamaClient).toHaveBeenCalledOnce()
    expect(createOllamaClient).toHaveBeenCalledWith('http://custom:1234', 'mistral', log)
    db.$client.close()
  })

  it('drain processes pending rows through the built ollama client', async () => {
    const db = createDb(':memory:')
    seedQueue(db, '123456')
    mockOllama.generate.mockResolvedValue(documentedResponse)
    createRankConsumer({ db, log, ollamaBaseUrl: 'http://custom:1234', ollamaModel: 'mistral' })

    const result = await consumerCaptured.opts?.drain()

    expect(result).toEqual({ total: 1 })
    expect(mockOllama.generate).toHaveBeenCalledOnce()
    const queue = db.select().from(analysisQueue).get()!
    expect(queue.completedAt).not.toBeNull()
    expect(log.info).toHaveBeenCalledWith({ jobId: expect.any(Number), title: 'Test Job' }, 'evaluated')
    db.$client.close()
  })
})
