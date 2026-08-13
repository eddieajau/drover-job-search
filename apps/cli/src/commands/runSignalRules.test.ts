/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue } from 'db'
import { createTestDb } from 'test-fixtures'
import { describe, expect, it, vi } from 'vitest'

import { runRunSignalRules, type RunSignalRulesOptions } from './runSignalRules.js'

const log: NonNullable<RunSignalRulesOptions['log']> = { info: vi.fn() }

describe('runRunSignalRules', () => {
  it('inserts exactly one pending run_signal_rules row on an empty queue', async () => {
    const db = createTestDb()

    await runRunSignalRules([], { db, log })

    const rows = db.select().from(analysisQueue).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].topic).toBe('run_signal_rules')
    expect(rows[0].jobId).toBeNull()
    expect(rows[0].completedAt).toBeNull()
    db.$client.close()
  })

  it('does not enqueue a second row while one is still pending', async () => {
    const db = createTestDb()

    await runRunSignalRules([], { db, log })
    await runRunSignalRules([], { db, log })

    const rows = db.select().from(analysisQueue).all()
    expect(rows).toHaveLength(1)
    expect(vi.mocked(log.info).mock.calls.at(-1)?.[0]).toEqual({ already_pending: true })
    db.$client.close()
  })
})
