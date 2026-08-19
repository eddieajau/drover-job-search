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
    status: {
      type: 'string',
      enum: ['applied', 'interviewing', 'skipped', 'discovered', 'declined', 'unsuccessful', 'successful'],
    },
    at: { type: 'string', format: 'date' },
    note: { type: 'string' },
  },
} as const

type StatusBody = {
  status: 'applied' | 'interviewing' | 'skipped' | 'discovered' | 'declined' | 'unsuccessful' | 'successful'
  at?: string
  note?: string
}

// TODO(ticket-140): Rewrite transition logic to use job_status_events
function transitionColumns(
  _status: StatusBody['status'],
  _timestamp: ReturnType<typeof sql>,
  _now: ReturnType<typeof sql>,
  _current: Record<string, unknown>
) {
  return {}
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
      const current = tx.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, id)).get()

      if (!current) {
        return undefined
      }

      const updated = tx
        .update(jobs)
        .set({
          status,
          ...transitionColumns(status, timestamp, now, current),
          updatedAt: now,
        })
        .where(eq(jobs.id, id))
        .returning()
        .get()

      if (
        updated &&
        note &&
        (status === 'applied' ||
          status === 'declined' ||
          status === 'interviewing' ||
          status === 'unsuccessful' ||
          status === 'successful')
      ) {
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
