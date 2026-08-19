/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobNotes, jobs } from 'db'
import { eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toJobNoteJson } from '../../../serializers.js'

const bodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'note'],
  properties: {
    kind: { type: 'string', enum: ['applied', 'declined', 'interviewing', 'general', 'unsuccessful', 'successful'] },
    note: { type: 'string', minLength: 1 },
  },
} as const

const postJobNotes: FastifyPluginAsync = async app => {
  app.post('/notes', { schema: { body: bodySchema } }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) {
      return reply.badRequest('Invalid job id')
    }

    const job = app.db.select().from(jobs).where(eq(jobs.id, id)).get()
    if (!job) {
      return reply.notFound(`Job ${id} not found`)
    }

    const { kind, note } = req.body as {
      kind: 'applied' | 'declined' | 'interviewing' | 'general' | 'unsuccessful' | 'successful'
      note: string
    }
    const row = app.db.insert(jobNotes).values({ jobId: id, kind, note }).returning().get()
    return reply.status(201).send(toJobNoteJson(row))
  })
}

export default postJobNotes
