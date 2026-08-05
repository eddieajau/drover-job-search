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

const analysisQueueRoutes: FastifyPluginAsync<AnalysisQueueRouteOptions> = async (app, { db }) => {
  app.get('/', async (req, reply) => {
    const { provider, providerJobId } = req.query as { provider?: string; providerJobId?: string }

    if (!providerJobId) {
      return reply.badRequest('Invalid query parameter: providerJobId')
    }

    const row = db
      .select({ queue: analysisQueue })
      .from(analysisQueue)
      .innerJoin(jobs, eq(analysisQueue.jobId, jobs.id))
      .where(and(eq(jobs.provider, provider ?? 'linkedin'), eq(jobs.providerJobId, providerJobId)))
      .get()

    if (!row) {
      return { queued: false }
    }
    return toQueueJson(row.queue)
  })

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

  app.delete('/', async (req, reply) => {
    const { provider, providerJobId } = req.query as { provider?: string; providerJobId?: string }

    if (!providerJobId) {
      return reply.badRequest('Invalid query parameter: providerJobId')
    }

    const job = db
      .select()
      .from(jobs)
      .where(and(eq(jobs.provider, provider ?? 'linkedin'), eq(jobs.providerJobId, providerJobId)))
      .get()
    if (!job) {
      return reply.notFound(`Job ${providerJobId} not found`)
    }

    db.delete(analysisQueue).where(eq(analysisQueue.jobId, job.id)).run()
    return { queued: false }
  })
}

export default analysisQueueRoutes
