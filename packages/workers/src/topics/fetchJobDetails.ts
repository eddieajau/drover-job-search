/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs, type DB } from 'db'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import { toMarkdown } from 'providers/common'

import { createConsumer, type Consumer } from '../consumer.js'
import { complete, fail, selectPending, type PendingRow } from '../queue.js'

export type DetailFn = (opts: { id: string }) => Promise<{ description: string | null; closed?: boolean } | null>

export function createFetchJobDetailsConsumer(opts: {
  db: DB
  log: Pick<FastifyBaseLogger, 'debug' | 'info' | 'warn' | 'error'>
  onDrained?: () => void
  detailFn: DetailFn
}): Consumer {
  return createConsumer({
    topic: 'fetch_job_details',
    drain: () =>
      drain(opts.db, {
        detailFn: opts.detailFn,
        onProgress: row => opts.log.debug({ providerJobId: row.providerJobId }, 'description saved'),
        onError: (row, err) =>
          err === null
            ? opts.log.warn({ providerJobId: row.providerJobId }, 'no description; marked done')
            : opts.log.error({ providerJobId: row.providerJobId, err }, 'detail fetch failed; marked done'),
        onSkip: (row, reason) => opts.log.debug({ providerJobId: row.providerJobId, reason }, 'job skipped'),
      }).then(r => ({ total: r.processed + r.failed + r.skipped })),
    onEmpty: () => opts.onDrained?.(),
    log: opts.log,
  })
}

export interface FetchDetailsDrainOptions {
  detailFn: DetailFn
  limit?: number
  onProgress?: (row: PendingRow) => void
  onError?: (row: PendingRow, err: unknown) => void
  onSkip?: (row: PendingRow, reason: 'closed') => void
}

export async function drain(
  db: DB,
  opts: FetchDetailsDrainOptions
): Promise<{ processed: number; failed: number; skipped: number }> {
  const rows = selectPending(db, 'fetch_job_details', opts.limit)
  let processed = 0
  let failed = 0
  let skipped = 0
  for (const row of rows) {
    const outcome = await drainOne(db, row.queueId, opts)
    if (outcome === 'written') processed++
    else if (outcome === 'skipped') skipped++
    else failed++
  }
  return { processed, failed, skipped }
}

export async function drainOne(
  db: DB,
  queueId: number,
  opts: FetchDetailsDrainOptions
): Promise<'written' | 'failed' | 'skipped'> {
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

async function processRow(
  db: DB,
  row: PendingRow,
  opts: FetchDetailsDrainOptions
): Promise<'written' | 'failed' | 'skipped'> {
  try {
    const result = await opts.detailFn({ id: row.providerJobId })

    if (!result) {
      fail(db, row.queueId, 'no description')
      opts.onError?.(row, null)
      return 'failed'
    }

    if (result.closed) {
      db.update(jobs)
        .set({
          status: 'skipped',
          processedBy: 'system',
          skipReason: 'No longer accepting applications',
          skippedAt: sql`(CURRENT_TIMESTAMP)`,
          updatedAt: sql`(CURRENT_TIMESTAMP)`,
        })
        .where(eq(jobs.id, row.jobId))
        .run()
      complete(db, row.queueId)
      opts.onSkip?.(row, 'closed')
      return 'skipped'
    }

    if (!result.description) {
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

    complete(db, row.queueId)
    opts.onProgress?.(row)
    return 'written'
  } catch (err) {
    fail(db, row.queueId, err instanceof Error ? err.message : String(err))
    opts.onError?.(row, err)
    return 'failed'
  }
}
