/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobs } from 'db'
import { eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

const postJobFlag: FastifyPluginAsync = async app => {
  app.post('/:jobId/flag', async (req, reply) => {
    const jobId = Number((req.params as { jobId: string }).jobId)
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return reply.badRequest('Invalid job id')
    }
    const job = app.db.select().from(jobs).where(eq(jobs.id, jobId)).get()
    if (!job) {
      return reply.notFound(`Job ${jobId} not found`)
    }
    app.queues.fetchJobDetails(jobId)
    return reply.code(202).send()
  })
}

export default postJobFlag
