/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs } from 'db'
import { desc, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import type { QueueSummaryResponse, QueueSummaryRow } from '../../serializers.js'

const getAnalysisQueueSummary: FastifyPluginAsync = async app => {
  app.get('/summary', async _req => {
    const stageRows = app.db
      .select({ stage: analysisQueue.topic, completed: analysisQueue.completedAt })
      .from(analysisQueue)
      .all()
    const pendingGetDetails = stageRows.filter(r => r.stage === 'fetch_job_details' && !r.completed).length
    const pendingRank = stageRows.filter(r => r.stage === 'rank' && !r.completed).length
    const done = stageRows.filter(r => r.completed).length

    const recent = app.db
      .select({
        id: analysisQueue.id,
        jobId: jobs.id,
        title: jobs.title,
        companyName: jobs.companyName,
        providerJobId: jobs.providerJobId,
        stage: analysisQueue.topic,
        queuedAt: analysisQueue.queuedAt,
        completedAt: analysisQueue.completedAt,
      })
      .from(analysisQueue)
      .innerJoin(jobs, eq(analysisQueue.jobId, jobs.id))
      .orderBy(desc(analysisQueue.id))
      .limit(20)
      .all()

    const summary: QueueSummaryResponse = {
      pending: { fetch_job_details: pendingGetDetails, rank: pendingRank },
      done,
      total: stageRows.length,
      recent: recent as QueueSummaryRow[],
    }
    return summary
  })
}

export default getAnalysisQueueSummary
