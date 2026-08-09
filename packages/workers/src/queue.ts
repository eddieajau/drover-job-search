/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs, type DB } from 'db'
import { and, eq, isNull, sql } from 'drizzle-orm'

export type AnalysisTopic = 'fetch_job_details' | 'rank'

export interface PendingRow {
  queueId: number
  jobId: number
  providerJobId: string
  title: string
}

export function selectPending(db: DB, topic: AnalysisTopic, limit?: number): PendingRow[] {
  const query = db
    .select({
      queueId: analysisQueue.id,
      jobId: jobs.id,
      providerJobId: jobs.providerJobId,
      title: jobs.title,
    })
    .from(analysisQueue)
    .innerJoin(jobs, eq(analysisQueue.jobId, jobs.id))
    .where(and(eq(analysisQueue.topic, topic), isNull(analysisQueue.completedAt)))
    .orderBy(analysisQueue.id)

  if (limit !== undefined) return query.limit(limit).all()
  return query.all()
}

export function advanceTo(db: DB, queueId: number, topic: AnalysisTopic): void {
  db.update(analysisQueue)
    .set({ topic, completedAt: null, errorMessage: null })
    .where(eq(analysisQueue.id, queueId))
    .run()
}

export function complete(db: DB, queueId: number): void {
  db.update(analysisQueue)
    .set({ completedAt: sql`(CURRENT_TIMESTAMP)`, errorMessage: null })
    .where(eq(analysisQueue.id, queueId))
    .run()
}

// Failures are terminal: the row leaves the pending set (completed_at is set)
// so a drain pass terminates. Retrying failed rows is deferred to a later
// iteration.
export function fail(db: DB, queueId: number, message: string): void {
  db.update(analysisQueue)
    .set({ errorMessage: message, completedAt: sql`(CURRENT_TIMESTAMP)` })
    .where(eq(analysisQueue.id, queueId))
    .run()
}
