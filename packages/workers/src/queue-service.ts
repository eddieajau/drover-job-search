/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, type DB } from 'db'

import type { AnalysisTopic } from './queue.js'

export interface QueueService {
  fetchJobDetails(jobId: number): void
}

export function createQueueService(opts: {
  db: DB
  onEnqueue?: (jobId: number, topic: AnalysisTopic) => void
}): QueueService {
  function enqueue(jobId: number, topic: AnalysisTopic): void {
    opts.db
      .insert(analysisQueue)
      .values({ jobId, topic, completedAt: null })
      .onConflictDoUpdate({
        target: analysisQueue.jobId,
        set: { completedAt: null, topic, errorMessage: null },
      })
      .run()
    opts.onEnqueue?.(jobId, topic)
  }

  return {
    fetchJobDetails: (jobId: number) => enqueue(jobId, 'fetch_job_details'),
  }
}
