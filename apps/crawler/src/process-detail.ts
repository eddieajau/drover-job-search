/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs, type DB } from 'db'
import { eq, isNull, sql } from 'drizzle-orm'
import type { Logger } from 'pino'

import { toMarkdown } from './to-markdown.js'

export type DetailFn = (opts: { id: string }) => Promise<{ description: string | null } | null>

export async function processDetailQueue(
  db: DB,
  detailFn: DetailFn,
  limit: number,
  log?: Logger
): Promise<{ processed: number; failed: number }> {
  const pending = db
    .select({
      queueId: analysisQueue.id,
      jobId: jobs.id,
      providerJobId: jobs.providerJobId,
    })
    .from(analysisQueue)
    .innerJoin(jobs, eq(analysisQueue.jobId, jobs.id))
    .where(isNull(analysisQueue.completedAt))
    .limit(limit)
    .all()

  log?.info({ pending: pending.length, limit }, 'pending jobs in analysis_queue')

  if (pending.length === 0) {
    return { processed: 0, failed: 0 }
  }

  let processed = 0
  let failed = 0

  for (const row of pending) {
    const detailUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${row.providerJobId}`
    log?.info({ providerJobId: row.providerJobId, url: detailUrl }, 'fetching detail')

    try {
      const result = await detailFn({ id: row.providerJobId })

      if (!result || !result.description) {
        log?.warn({ providerJobId: row.providerJobId }, 'no description returned; leaving pending')
        failed++
        continue
      }

      db.update(jobs)
        .set({
          description: toMarkdown(result.description),
          updatedAt: sql`(CURRENT_TIMESTAMP)`,
        })
        .where(eq(jobs.id, row.jobId))
        .run()

      db.update(analysisQueue)
        .set({ completedAt: sql`(CURRENT_TIMESTAMP)` })
        .where(eq(analysisQueue.id, row.queueId))
        .run()

      log?.info({ providerJobId: row.providerJobId }, 'description saved')
      processed++
    } catch (err) {
      log?.error({ providerJobId: row.providerJobId, err }, 'detail fetch failed; leaving pending')
      failed++
    }
  }

  return { processed, failed }
}
