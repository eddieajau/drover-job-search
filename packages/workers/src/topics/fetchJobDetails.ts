/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs, type DB } from 'db'
import { and, eq, isNull, sql } from 'drizzle-orm'

import { toMarkdown } from '../lib/markdown.js'
import { advanceTo, fail, selectPending, type PendingRow } from '../queue.js'

export type DetailFn = (opts: { id: string }) => Promise<{ description: string | null } | null>

export interface FetchDetailsDrainOptions {
  detailFn: DetailFn
  limit?: number
  onProgress?: (row: PendingRow) => void
  onError?: (row: PendingRow, err: unknown) => void
}

export async function drain(db: DB, opts: FetchDetailsDrainOptions): Promise<{ processed: number; failed: number }> {
  const rows = selectPending(db, 'fetch_job_details', opts.limit)
  let processed = 0
  let failed = 0
  for (const row of rows) {
    const outcome = await drainOne(db, row.queueId, opts)
    if (outcome === 'written') processed++
    else failed++
  }
  return { processed, failed }
}

export async function drainOne(db: DB, queueId: number, opts: FetchDetailsDrainOptions): Promise<'written' | 'failed'> {
  const row = selectPendingRow(db, queueId)
  if (!row) return 'failed'
  return processRow(db, row, opts)
}

function selectPendingRow(db: DB, queueId: number): PendingRow | null {
  return (
    db
      .select({
        queueId: analysisQueue.id,
        jobId: jobs.id,
        providerJobId: jobs.providerJobId,
        title: jobs.title,
      })
      .from(analysisQueue)
      .innerJoin(jobs, eq(analysisQueue.jobId, jobs.id))
      .where(
        and(
          eq(analysisQueue.id, queueId),
          eq(analysisQueue.topic, 'fetch_job_details'),
          isNull(analysisQueue.completedAt)
        )
      )
      .get() ?? null
  )
}

async function processRow(db: DB, row: PendingRow, opts: FetchDetailsDrainOptions): Promise<'written' | 'failed'> {
  try {
    const result = await opts.detailFn({ id: row.providerJobId })

    if (!result?.description) {
      fail(db, row.queueId, 'no description')
      opts.onError?.(row, null)
      return 'failed'
    }

    db.update(jobs)
      .set({
        description: toMarkdown(result.description),
        updatedAt: sql`(CURRENT_TIMESTAMP)`,
      })
      .where(eq(jobs.id, row.jobId))
      .run()

    advanceTo(db, row.queueId, 'rank')
    opts.onProgress?.(row)
    return 'written'
  } catch (err) {
    fail(db, row.queueId, err instanceof Error ? err.message : String(err))
    opts.onError?.(row, err)
    return 'failed'
  }
}
