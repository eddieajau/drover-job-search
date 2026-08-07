/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobs } from 'db'
import { eq, sql } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toJobJson } from '../../serializers.js'

const bodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['applied', 'skipped'] },
  },
} as const

const patchJobStatus: FastifyPluginAsync = async app => {
  app.patch('/:id/status', { schema: { body: bodySchema } }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) {
      return reply.badRequest('Invalid job id')
    }

    const { status } = req.body as { status: 'applied' | 'skipped' }
    const now = sql`(CURRENT_TIMESTAMP)`

    const row = app.db
      .update(jobs)
      .set({
        status,
        appliedAt: status === 'applied' ? now : null,
        skippedAt: status === 'skipped' ? now : null,
        updatedAt: now,
      })
      .where(eq(jobs.id, id))
      .returning()
      .get()

    if (!row) {
      return reply.notFound(`Job ${id} not found`)
    }

    return toJobJson(row)
  })
}

export default patchJobStatus
