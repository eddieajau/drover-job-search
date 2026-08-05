import { createDb, jobSignals, jobs } from 'db'
import { describe, it, expect } from 'vitest'

import { evaluateJob, selectJobsForEval } from './evaluate.js'
import type { OllamaClient } from './ollama.js'

function seedJob(db: ReturnType<typeof createDb>, description: string | null = 'A great job') {
  db.insert(jobs)
    .values({
      provider: 'linkedin',
      providerJobId: 'job-1',
      title: 'Test Job',
      companyName: 'Acme',
      url: 'https://example.com/1',
      location: 'Remote',
      description,
    })
    .run()
  return db.select().from(jobs).get()!
}

function mockClient(response: string): OllamaClient {
  return { generate: async () => response }
}

function failingClient(): OllamaClient {
  return { generate: async () => Promise.reject(new Error('network error')) }
}

describe('evaluateJob', () => {
  it('writes llm_deep_eval signal for valid JSON response', async () => {
    const db = createDb(':memory:')
    const job = seedJob(db)

    const response = JSON.stringify({
      score: 75,
      signal_type: 'skill_match',
      matched_keywords: ['TypeScript', 'Node.js'],
      reason: 'Strong technical match',
    })

    const result = await evaluateJob(db, job.id, mockClient(response))
    expect(result).toBe('written')

    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(1)
    expect(signals[0].source).toBe('llm_deep_eval')
    expect(signals[0].signalType).toBe('skill_match')
    expect(signals[0].score).toBe(75)
    expect(signals[0].ruleId).toBeNull()

    const meta = JSON.parse(signals[0].metadata!)
    expect(meta.matched_keywords).toEqual(['TypeScript', 'Node.js'])
    expect(meta.reason).toBe('Strong technical match')

    db.$client.close()
  })

  it('clamps score to -100..100', async () => {
    const db = createDb(':memory:')
    const job = seedJob(db)

    const response = JSON.stringify({
      score: 999,
      signal_type: 'skill_match',
      matched_keywords: [],
      reason: 'test',
    })

    await evaluateJob(db, job.id, mockClient(response))

    const signal = db.select().from(jobSignals).get()!
    expect(signal.score).toBe(100)
    db.$client.close()
  })

  it('skips job when LLM returns malformed JSON', async () => {
    const db = createDb(':memory:')
    const job = seedJob(db)

    const result = await evaluateJob(db, job.id, mockClient('not json'))
    expect(result).toBe('skipped')

    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(0)
    db.$client.close()
  })

  it('skips job when LLM response has wrong shape', async () => {
    const db = createDb(':memory:')
    const job = seedJob(db)

    const response = JSON.stringify({ score: 'not a number', signal_type: 'skill_match' })
    const result = await evaluateJob(db, job.id, mockClient(response))
    expect(result).toBe('skipped')
    db.$client.close()
  })

  it('skips job when signal_type is invalid', async () => {
    const db = createDb(':memory:')
    const job = seedJob(db)

    const response = JSON.stringify({
      score: 50,
      signal_type: 'invalid_type',
      matched_keywords: [],
      reason: 'test',
    })
    const result = await evaluateJob(db, job.id, mockClient(response))
    expect(result).toBe('skipped')
    db.$client.close()
  })

  it('skips job when ollama client throws', async () => {
    const db = createDb(':memory:')
    const job = seedJob(db)

    const result = await evaluateJob(db, job.id, failingClient())
    expect(result).toBe('skipped')
    db.$client.close()
  })

  it('replaces existing llm_deep_eval signal for same job', async () => {
    const db = createDb(':memory:')
    const job = seedJob(db)

    const first = JSON.stringify({
      score: 50,
      signal_type: 'skill_match',
      matched_keywords: ['old'],
      reason: 'first eval',
    })
    await evaluateJob(db, job.id, mockClient(first))

    const second = JSON.stringify({
      score: 80,
      signal_type: 'company_match',
      matched_keywords: ['new'],
      reason: 'second eval',
    })
    await evaluateJob(db, job.id, mockClient(second))

    const signals = db.select().from(jobSignals).all()
    expect(signals).toHaveLength(1)
    expect(signals[0].score).toBe(80)
    expect(signals[0].signalType).toBe('company_match')
    db.$client.close()
  })

  it('skips job with no description', async () => {
    const db = createDb(':memory:')
    const job = seedJob(db, null)

    const result = await evaluateJob(db, job.id, mockClient('{}'))
    expect(result).toBe('skipped')
    db.$client.close()
  })
})

describe('selectJobsForEval', () => {
  it('returns jobs with description that have no existing llm_deep_eval signal', () => {
    const db = createDb(':memory:')

    db.insert(jobs)
      .values([
        {
          provider: 'linkedin',
          providerJobId: 'has-desc',
          title: 'Job A',
          companyName: 'Acme',
          url: 'https://example.com/a',
          location: 'Remote',
          description: 'Has description',
        },
        {
          provider: 'linkedin',
          providerJobId: 'no-desc',
          title: 'Job B',
          companyName: 'Beta',
          url: 'https://example.com/b',
          location: 'Remote',
        },
      ])
      .run()

    const pending = selectJobsForEval(db)
    expect(pending).toHaveLength(1)

    const jobA = db
      .select()
      .from(jobs)
      .where()
      .all()
      .find(j => j.providerJobId === 'has-desc')!
    expect(pending[0].id).toBe(jobA.id)
    db.$client.close()
  })

  it('excludes jobs that already have an llm_deep_eval signal', () => {
    const db = createDb(':memory:')

    db.insert(jobs)
      .values({
        provider: 'linkedin',
        providerJobId: 'evaluated',
        title: 'Job A',
        companyName: 'Acme',
        url: 'https://example.com/a',
        location: 'Remote',
        description: 'Has description',
      })
      .run()

    const job = db.select().from(jobs).get()!

    db.insert(jobSignals)
      .values({
        jobId: job.id,
        ruleId: null,
        source: 'llm_deep_eval',
        signalType: 'skill_match',
        score: 50,
      })
      .run()

    const pending = selectJobsForEval(db)
    expect(pending).toHaveLength(0)
    db.$client.close()
  })
})
