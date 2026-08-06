/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs } from 'db'
import { and, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toQueueJson } from '../../serializers.js'

const getAnalysisQueue: FastifyPluginAsync = async app => {
  app.get('/', async (req, reply) => {
    const { provider, providerJobId } = req.query as { provider?: string; providerJobId?: string }

    if (!providerJobId) {
      return reply.badRequest('Invalid query parameter: providerJobId')
    }

    const row = app.db
      .select({ queue: analysisQueue })
      .from(analysisQueue)
      .innerJoin(jobs, eq(analysisQueue.jobId, jobs.id))
      .where(and(eq(jobs.provider, provider ?? 'linkedin'), eq(jobs.providerJobId, providerJobId)))
      .get()

    if (!row) {
      return reply.code(200).send({ queued: false })
    }
    return toQueueJson(row.queue)
  })
}

export default getAnalysisQueue
