/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue } from 'db'
import { eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toQueueJson } from '../../../serializers.js'

const getJobQueue: FastifyPluginAsync = async app => {
  app.get('/queue', async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) {
      return reply.badRequest('Invalid job id')
    }

    const row = app.db.select({ queue: analysisQueue }).from(analysisQueue).where(eq(analysisQueue.jobId, id)).get()

    if (!row) {
      return reply.code(200).send({ queued: false })
    }
    return toQueueJson(row.queue)
  })
}

export default getJobQueue
