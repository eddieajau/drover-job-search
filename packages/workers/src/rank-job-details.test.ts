/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, createDb, jobSignals, jobs, type DB } from 'db'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OllamaClient } from './ollama.js'
import { advanceTo } from './queue.js'
import { drain, drainOne } from './rank-job-details.js'

describe('rank-job-details drain', () => {
  let db: ReturnType<typeof createDb>

  beforeEach(() => {
    db = createDb(':memory:')
  })

  afterEach(() => {
    db.$client.close()
  })

  function seedQueue(
    db: DB,
    providerJobId: string,
    description: string | null = 'A great job',
    stage: 'fetch_job_details' | 'rank' = 'rank'
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
    db.insert(analysisQueue).values({ jobId: job.id, stage }).run()
    const queue = db
      .select()
      .from(analysisQueue)
      .all()
      .find(q => q.jobId === job.id)!
    return { jobId: job.id, queueId: queue.id }
  }

  function mockClient(response: string): OllamaClient {
    return { generate: async () => response }
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
    advanceTo(db, queueId, 'rank')

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

  it('does not pick up rows still at stage fetch_job_details', async () => {
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
