/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobNotes, jobs } from 'db'
import { desc, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toJobNoteJson } from '../../../serializers.js'

const getJobNotes: FastifyPluginAsync = async app => {
  app.get('/notes', async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) {
      return reply.badRequest('Invalid job id')
    }

    const job = app.db.select().from(jobs).where(eq(jobs.id, id)).get()
    if (!job) {
      return reply.notFound(`Job ${id} not found`)
    }

    const rows = app.db
      .select()
      .from(jobNotes)
      .where(eq(jobNotes.jobId, id))
      .orderBy(desc(jobNotes.createdAt), desc(jobNotes.id))
      .all()
    return rows.map(toJobNoteJson)
  })
}

export default getJobNotes
