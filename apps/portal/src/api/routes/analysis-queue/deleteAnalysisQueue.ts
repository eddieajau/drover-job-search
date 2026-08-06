/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs } from 'db'
import { and, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

const deleteAnalysisQueue: FastifyPluginAsync = async app => {
  app.delete('/', async (req, reply) => {
    const { provider, providerJobId } = req.query as { provider?: string; providerJobId?: string }

    if (!providerJobId) {
      return reply.badRequest('Invalid query parameter: providerJobId')
    }

    const job = app.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.provider, provider ?? 'linkedin'), eq(jobs.providerJobId, providerJobId)))
      .get()
    if (!job) {
      return reply.notFound(`Job ${providerJobId} not found`)
    }

    app.db.delete(analysisQueue).where(eq(analysisQueue.jobId, job.id)).run()
    return reply.code(200).send({ queued: false })
  })
}

export default deleteAnalysisQueue
