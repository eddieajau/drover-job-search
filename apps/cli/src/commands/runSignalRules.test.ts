/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs, signalRules } from 'db'
import { createTestDb } from 'test-fixtures'
import { describe, expect, it, vi } from 'vitest'

import { runRunSignalRules, type RunSignalRulesOptions } from './runSignalRules.js'

const log: NonNullable<RunSignalRulesOptions['log']> = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

describe('runRunSignalRules', () => {
  it('inserts a singleton sweep row and drains it in-process', async () => {
    const db = createTestDb()

    await runRunSignalRules([], { db, log })

    const rows = db.select().from(analysisQueue).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].topic).toBe('run_signal_rules')
    expect(rows[0].jobId).toBeNull()
    expect(rows[0].completedAt).not.toBeNull()
    db.$client.close()
  })

  it('drains an existing pending row instead of enqueueing a second', async () => {
    const db = createTestDb()
    db.insert(analysisQueue).values({ jobId: null, topic: 'run_signal_rules' }).run()

    await runRunSignalRules([], { db, log })

    const rows = db.select().from(analysisQueue).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].completedAt).not.toBeNull()
    expect(vi.mocked(log.info).mock.calls.some(call => call[0].already_pending === true)).toBe(true)
    db.$client.close()
  })

  it('runs the signal-rule sweep against the database', async () => {
    const db = createTestDb()
    db.insert(jobs)
      .values({
        provider: 'linkedin',
        providerJobId: 'matching',
        title: 'Senior Java Developer',
        companyName: 'Acme',
        url: 'https://example.com/matching',
        location: 'Remote',
      })
      .run()
    db.insert(signalRules)
      .values({
        ruleName: 'java',
        ruleCategory: 'regex_title',
        pattern: '(?i)\\bjava\\b',
        signalType: 'dealbreaker',
        enabled: true,
      })
      .run()

    await runRunSignalRules([], { db, log })

    const job = db.select().from(jobs).get()!
    expect(job.status).toBe('blocked')
    db.$client.close()
  })
})
