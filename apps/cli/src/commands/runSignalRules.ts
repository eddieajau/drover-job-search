/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, type DB } from 'db'
import { and, eq, isNull } from 'drizzle-orm'
import { pino } from 'pino'
import { drainSweep } from 'workers'

import { openDb } from '../env.js'

export interface RunSignalRulesOptions {
  db?: DB
  log?: {
    debug(obj: object, msg?: string): void
    info(obj: object, msg?: string): void
    warn(obj: object, msg?: string): void
    error(obj: object, msg?: string): void
  }
}

// Publishes a run_signal_rules sweep row (a singleton in the queue) and drains
// it in-process, so the sweep runs even when the portal worker loop is down.
// The queue row keeps the "at most one pending sweep" contract with the portal
// consumer; both drain paths run the same drainSweep logic.
export async function runRunSignalRules(_args: string[], options: RunSignalRulesOptions = {}): Promise<void> {
  const ownsDb = options.db === undefined
  const db = options.db ?? openDb()
  const log = options.log ?? pino({ base: undefined, level: process.env.LOG_LEVEL ?? 'info' })

  // The sweep is a singleton in the queue: don't enqueue a second pending row
  // if one is already pending.
  const existing = db
    .select()
    .from(analysisQueue)
    .where(and(eq(analysisQueue.topic, 'run_signal_rules'), isNull(analysisQueue.completedAt)))
    .get()

  if (!existing) {
    db.insert(analysisQueue).values({ jobId: null, topic: 'run_signal_rules', completedAt: null }).run()
  }
  log.info({ already_pending: !!existing }, 'run_signal_rules sweep enqueued')

  const { written, skipped } = await drainSweep(db, log)
  log.info({ written, skipped }, 'run_signal_rules sweep complete')

  if (ownsDb) db.$client.close()
}
