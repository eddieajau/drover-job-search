/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, type DB } from 'db'

import type { AnalysisStage } from './queue.js'

export interface QueueService {
  fetchJobDetails(jobId: number): void
}

export function createQueueService(opts: {
  db: DB
  onEnqueue?: (jobId: number, stage: AnalysisStage) => void
}): QueueService {
  function enqueue(jobId: number, stage: AnalysisStage): void {
    opts.db
      .insert(analysisQueue)
      .values({ jobId, stage, completedAt: null })
      .onConflictDoUpdate({
        target: analysisQueue.jobId,
        set: { completedAt: null, stage, errorMessage: null },
      })
      .run()
    opts.onEnqueue?.(jobId, stage)
  }

  return {
    fetchJobDetails: (jobId: number) => enqueue(jobId, 'fetch_job_details'),
  }
}
