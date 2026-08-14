/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, type DB } from 'db'

import type { AnalysisTopic } from './queue.js'

export interface Publisher {
  publish(jobId: number, topic: AnalysisTopic): void
  publishMany(jobId: number, topics: readonly AnalysisTopic[]): void
}

export function createPublisher(opts: {
  db: DB
  onEnqueue?: (jobId: number, topic: AnalysisTopic) => void
}): Publisher {
  function enqueue(jobId: number, topic: AnalysisTopic): void {
    opts.db.insert(analysisQueue).values({ jobId, topic, completedAt: null }).run()
    opts.onEnqueue?.(jobId, topic)
  }

  return {
    publish: (jobId: number, topic: AnalysisTopic) => enqueue(jobId, topic),
    publishMany: (jobId: number, topics: readonly AnalysisTopic[]) => {
      for (const topic of topics) enqueue(jobId, topic)
    },
  }
}
