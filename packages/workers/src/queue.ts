/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs, type DB } from 'db'
import { and, eq, isNull, sql } from 'drizzle-orm'

export type AnalysisTopic = 'fetch_job_details' | 'rank' | 'run_signal_rules'

export interface PendingRow {
  queueId: number
  jobId: number
  providerJobId: string
  title: string
}

// Sweep topics (e.g. run_signal_rules) don't carry job data — their rows have
// jobId = null and the consumer ignores the job-shaped sentinel fields.
const SWEEP_TOPICS = new Set<AnalysisTopic>(['run_signal_rules'])

export function selectPending(db: DB, topic: AnalysisTopic, limit?: number): PendingRow[] {
  if (SWEEP_TOPICS.has(topic)) {
    const query = db
      .select({ queueId: analysisQueue.id })
      .from(analysisQueue)
      .where(and(eq(analysisQueue.topic, topic), isNull(analysisQueue.completedAt)))
      .orderBy(analysisQueue.id)
    const rows = (limit !== undefined ? query.limit(limit).all() : query.all()).map(row => ({
      queueId: row.queueId,
      jobId: 0,
      providerJobId: '',
      title: '',
    }))
    return rows
  }

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

export function completeAndAdvance(db: DB, queueId: number, nextTopic: AnalysisTopic): void {
  db.update(analysisQueue)
    .set({ completedAt: sql`(CURRENT_TIMESTAMP)`, errorMessage: null })
    .where(eq(analysisQueue.id, queueId))
    .run()

  const row = db.select({ jobId: analysisQueue.jobId }).from(analysisQueue).where(eq(analysisQueue.id, queueId)).get()

  if (row) {
    db.insert(analysisQueue).values({ jobId: row.jobId, topic: nextTopic, completedAt: null }).run()
  }
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
