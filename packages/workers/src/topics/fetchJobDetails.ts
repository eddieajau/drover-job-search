/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobs, type DB } from 'db'
import { eq, sql } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import { toMarkdown } from 'providers/common'

import { createConsumer, type Consumer } from '../consumer.js'
import { drainRows } from '../lib/drainQueue.js'
import { complete, fail, selectPendingRow, type PendingRow } from '../queue.js'

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
  return drainRows(db, 'fetch_job_details', {
    limit: opts.limit,
    processRow: row => drainOne(db, row.queueId, opts),
  }).then(({ written, failed, skipped }) => ({ processed: written, failed, skipped }))
}

export async function drainOne(
  db: DB,
  queueId: number,
  opts: FetchDetailsDrainOptions
): Promise<'written' | 'failed' | 'skipped'> {
  const row = selectPendingRow(db, 'fetch_job_details', queueId)
  if (!row) return 'failed'
  return processRow(db, row, opts)
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
          closedAt: sql`(CURRENT_TIMESTAMP)`,
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
