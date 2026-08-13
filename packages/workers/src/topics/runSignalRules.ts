/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { DB } from 'db'
import type { FastifyBaseLogger } from 'fastify'

import { createConsumer, type Consumer } from '../consumer.js'
import { reconcileBlockedForAllJobs } from '../lib/reconcileBlocked.js'
import { complete, selectPending } from '../queue.js'
import { runEnabledRules } from '../signal/rules.js'

export function createRunSignalRulesConsumer(opts: {
  db: DB
  log: Pick<FastifyBaseLogger, 'debug' | 'info' | 'warn' | 'error'>
}): Consumer {
  return createConsumer({
    topic: 'run_signal_rules',
    drain: () => drainSweep(opts.db, opts.log).then(r => ({ total: r.written + r.skipped })),
    log: opts.log,
  })
}

// Sweep rows are a singleton in the queue (the CLI publisher in ticket 110
// enforces "at most one pending row"); this drain just processes what it finds.
export async function drainSweep(
  db: DB,
  log: Pick<FastifyBaseLogger, 'debug' | 'info' | 'warn' | 'error'>
): Promise<{ written: number; skipped: number }> {
  const rows = selectPending(db, 'run_signal_rules')
  let written = 0
  let skipped = 0
  for (const row of rows) {
    const summary = runEnabledRules(db, log)
    reconcileBlockedForAllJobs(db)
    complete(db, row.queueId)
    log.debug({ ruleCount: Object.keys(summary).length }, 'signal rules sweep complete')
    written++
  }
  return { written, skipped }
}
