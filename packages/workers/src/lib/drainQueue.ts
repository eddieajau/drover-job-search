/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { DB } from 'db'

import { selectPending, type AnalysisTopic, type PendingRow } from '../queue.js'

export type RowOutcome = 'written' | 'skipped' | 'failed'

export interface DrainRowsOptions {
  limit?: number
  processRow: (row: PendingRow) => Promise<RowOutcome>
}

// Shared queue-drain loop: selects pending rows for a topic, processes them
// sequentially in id order, and tallies outcomes. A queue worker supplies only
// its per-row implementation; selection and tallying live here so the topic
// modules don't duplicate them.
export async function drainRows(
  db: DB,
  topic: AnalysisTopic,
  opts: DrainRowsOptions
): Promise<{ written: number; skipped: number; failed: number }> {
  const rows = selectPending(db, topic, opts.limit)
  const tally = { written: 0, skipped: 0, failed: 0 }
  for (const row of rows) {
    tally[await opts.processRow(row)]++
  }
  return tally
}
