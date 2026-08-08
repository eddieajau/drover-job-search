/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs } from 'db'
import { and, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toQueueJson } from '../../serializers.js'

const postAnalysisQueue: FastifyPluginAsync = async app => {
  app.post('/', async (req, reply) => {
    const { provider, providerJobId } = req.body as { provider?: string; providerJobId?: string }

    if (!providerJobId) {
      return reply.badRequest('Invalid body parameter: providerJobId')
    }

    const job = app.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.provider, provider ?? 'linkedin'), eq(jobs.providerJobId, providerJobId)))
      .get()
    if (!job) {
      return reply.notFound(`Job ${providerJobId} not found`)
    }

    app.db
      .insert(analysisQueue)
      .values({ jobId: job.id, stage: 'fetch_job_details', completedAt: null })
      .onConflictDoUpdate({
        target: analysisQueue.jobId,
        set: { completedAt: null, stage: 'fetch_job_details', errorMessage: null },
      })
      .run()

    const row = app.db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).get()
    if (!row) {
      return reply.internalServerError('Failed to reload queue row')
    }
    return toQueueJson(row)
  })
}

export default postAnalysisQueue
