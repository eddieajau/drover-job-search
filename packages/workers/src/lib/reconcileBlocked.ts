/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobSignals, jobs, type DB } from 'db'
import { and, eq, inArray, sql } from 'drizzle-orm'

// Full sweep variant: every 'new'/'blocked' job is reconciled against its
// dealbreaker rows in BOTH directions (new -> blocked when a dealbreaker
// exists, blocked -> new when none do). Owned by the run_signal_rules sweep;
// it keys off ALL signalType='dealbreaker' rows, including LLM-written ones.
export function reconcileBlockedForAllJobs(db: DB): void {
  const dealbreakerJobIds = db
    .select({ jobId: jobSignals.jobId })
    .from(jobSignals)
    .where(eq(jobSignals.signalType, 'dealbreaker'))
    .all()
    .map(row => row.jobId)

  const blockedJobIds = new Set(dealbreakerJobIds)

  const candidateJobs = db
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(inArray(jobs.status, ['new', 'blocked']))
    .all()

  for (const job of candidateJobs) {
    const hasDealbreaker = blockedJobIds.has(job.id)
    if (hasDealbreaker && job.status === 'new') {
      db.update(jobs)
        .set({ status: 'blocked', updatedAt: sql`(CURRENT_TIMESTAMP)` })
        .where(eq(jobs.id, job.id))
        .run()
    } else if (!hasDealbreaker && job.status === 'blocked') {
      db.update(jobs)
        .set({ status: 'new', updatedAt: sql`(CURRENT_TIMESTAMP)` })
        .where(eq(jobs.id, job.id))
        .run()
    }
  }
}

// Per-job variant: flips 'new' -> 'blocked' when dealbreaker rows exist for the
// job. The reverse direction is NOT here — the sweep owns the unblock. This is
// the call topics/rank makes after writing its own LLM signals.
export function reconcileBlockedForJob(db: DB, jobId: number): void {
  const dealbreakerCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobSignals)
      .where(and(eq(jobSignals.jobId, jobId), eq(jobSignals.signalType, 'dealbreaker')))
      .get()?.count ?? 0

  if (dealbreakerCount > 0) {
    db.update(jobs)
      .set({ status: 'blocked', updatedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(and(eq(jobs.id, jobId), eq(jobs.status, 'new')))
      .run()
  }
}
