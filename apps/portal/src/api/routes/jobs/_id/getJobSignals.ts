/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobSignals, jobs } from 'db'
import { asc, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toSignalJson } from '../../../serializers.js'

const getJobSignals: FastifyPluginAsync = async app => {
  app.get('/signals', async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) {
      return reply.badRequest('Invalid job id')
    }

    const job = app.db.select().from(jobs).where(eq(jobs.id, id)).get()
    if (!job) {
      return reply.notFound(`Job ${id} not found`)
    }

    const rows = app.db.select().from(jobSignals).where(eq(jobSignals.jobId, id)).orderBy(asc(jobSignals.id)).all()
    return rows.map(toSignalJson)
  })
}

export default getJobSignals
