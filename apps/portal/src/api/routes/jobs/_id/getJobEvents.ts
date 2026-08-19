/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobStatusEvents, jobs } from 'db'
import { eq, sql } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

const getJobEvents: FastifyPluginAsync = async app => {
  app.get('/events', async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) {
      return reply.badRequest('Invalid job id')
    }

    const job = app.db.select().from(jobs).where(eq(jobs.id, id)).get()
    if (!job) {
      return reply.notFound(`Job ${id} not found`)
    }

    const events = app.db
      .select()
      .from(jobStatusEvents)
      .where(eq(jobStatusEvents.jobId, id))
      .orderBy(sql`${jobStatusEvents.occurredAt} DESC`)
      .all()

    return events
  })
}

export default getJobEvents
