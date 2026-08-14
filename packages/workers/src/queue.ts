/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs, type DB } from 'db'
import { and, eq, inArray, isNull, not, sql } from 'drizzle-orm'

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

  if (topic === 'rank') {
    // Per-job ordering: a rank row for a job only drains once that job has no
    // pending fetch_job_details row — rank is caller-owned, not chained by the
    // fetch worker.
    // Sweep-first: no rank row drains while a run_signal_rules row is pending.
    // Sweep rows carry jobId = null so they can't be keyed per-job; the CLI
    // (ticket 110) keeps them a singleton in the queue, so the stall is bounded
    // by a single sweep pass.
    const sweepPending = db
      .select({ id: analysisQueue.id })
      .from(analysisQueue)
      .where(and(eq(analysisQueue.topic, 'run_signal_rules'), isNull(analysisQueue.completedAt)))
      .get()
    if (sweepPending) return []

    const query = db
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
          eq(analysisQueue.topic, 'rank'),
          isNull(analysisQueue.completedAt),
          not(
            inArray(
              analysisQueue.jobId,
              db
                .select({ jobId: analysisQueue.jobId })
                .from(analysisQueue)
                .where(and(eq(analysisQueue.topic, 'fetch_job_details'), isNull(analysisQueue.completedAt)))
            )
          )
        )
      )
      .orderBy(analysisQueue.id)

    if (limit !== undefined) return query.limit(limit).all()
    return query.all()
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
