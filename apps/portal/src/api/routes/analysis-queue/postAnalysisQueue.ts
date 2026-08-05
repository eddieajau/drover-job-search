/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs, type DB } from 'db'
import { and, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toQueueJson } from '../../serializers.js'

interface AnalysisQueueRouteOptions {
  db: DB
}

const postAnalysisQueue: FastifyPluginAsync<AnalysisQueueRouteOptions> = async (app, { db }) => {
  app.post('/', async (req, reply) => {
    const { provider, providerJobId } = req.body as { provider?: string; providerJobId?: string }

    if (!providerJobId) {
      return reply.badRequest('Invalid body parameter: providerJobId')
    }

    const job = db
      .select()
      .from(jobs)
      .where(and(eq(jobs.provider, provider ?? 'linkedin'), eq(jobs.providerJobId, providerJobId)))
      .get()
    if (!job) {
      return reply.notFound(`Job ${providerJobId} not found`)
    }

    db.insert(analysisQueue)
      .values({ jobId: job.id, completedAt: null })
      .onConflictDoUpdate({ target: analysisQueue.jobId, set: { completedAt: null } })
      .run()

    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).get()
    if (!row) {
      return reply.internalServerError('Failed to reload queue row')
    }
    return toQueueJson(row)
  })
}

export default postAnalysisQueue
