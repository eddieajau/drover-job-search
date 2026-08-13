/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, type DB } from 'db'
import { and, eq, isNull } from 'drizzle-orm'
import { pino } from 'pino'

import { openDb } from '../env.js'

export interface RunSignalRulesOptions {
  db?: DB
  log?: { info(obj: object, msg?: string): void }
}

// Publishes a run_signal_rules sweep row and exits. The portal worker loop
// (ticket 109's consumer) drains the row and runs the actual rule sweep, so
// the portal must be running for the sweep to happen.
export async function runRunSignalRules(_args: string[], options: RunSignalRulesOptions = {}): Promise<void> {
  const ownsDb = options.db === undefined
  const db = options.db ?? openDb()
  const log = options.log ?? pino({ base: undefined, level: process.env.LOG_LEVEL ?? 'info' })

  // The sweep is a singleton in the queue: don't enqueue a second pending row
  // if one is already pending (the portal drains it on its next kick).
  const existing = db
    .select()
    .from(analysisQueue)
    .where(and(eq(analysisQueue.topic, 'run_signal_rules'), isNull(analysisQueue.completedAt)))
    .get()

  if (!existing) {
    db.insert(analysisQueue).values({ jobId: null, topic: 'run_signal_rules', completedAt: null }).run()
  }
  log.info({ already_pending: !!existing }, 'run_signal_rules enqueued')

  if (ownsDb) db.$client.close()
}
