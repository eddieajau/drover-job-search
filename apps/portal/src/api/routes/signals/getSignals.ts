/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobSignals, jobs } from 'db'
import { and, asc, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toSignalJson } from '../../serializers.js'

const getSignals: FastifyPluginAsync = async app => {
  app.get('/', async (req, reply) => {
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

    const rows = app.db.select().from(jobSignals).where(eq(jobSignals.jobId, job.id)).orderBy(asc(jobSignals.id)).all()
    return rows.map(toSignalJson)
  })
}

export default getSignals
