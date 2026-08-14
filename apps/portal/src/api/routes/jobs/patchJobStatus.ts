/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobNotes, jobs } from 'db'
import { eq, sql } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toJobJson } from '../../serializers.js'

const bodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['applied', 'skipped', 'discovered', 'declined'] },
    at: { type: 'string', format: 'date' },
    note: { type: 'string', maxLength: 2000 },
  },
} as const

type StatusBody = {
  status: 'applied' | 'skipped' | 'discovered' | 'declined'
  at?: string
  note?: string
}

const patchJobStatus: FastifyPluginAsync = async app => {
  app.patch('/:id/status', { schema: { body: bodySchema } }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) {
      return reply.badRequest('Invalid job id')
    }

    const { status, at, note } = req.body as StatusBody
    const now = sql`(CURRENT_TIMESTAMP)`
    const timestamp = at ? sql`${at}` : now

    const row = app.db.transaction(tx => {
      const updated = tx
        .update(jobs)
        .set({
          status,
          appliedAt: status === 'applied' ? timestamp : null,
          skippedAt: status === 'skipped' ? now : null,
          declinedAt: status === 'declined' ? timestamp : null,
          updatedAt: now,
        })
        .where(eq(jobs.id, id))
        .returning()
        .get()

      if (updated && note && (status === 'applied' || status === 'declined')) {
        tx.insert(jobNotes).values({ jobId: id, kind: status, note }).run()
      }

      return updated
    })

    if (!row) {
      return reply.notFound(`Job ${id} not found`)
    }

    return toJobJson(row)
  })
}

export default patchJobStatus
