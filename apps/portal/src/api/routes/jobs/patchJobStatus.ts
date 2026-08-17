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
    status: { type: 'string', enum: ['applied', 'interviewing', 'skipped', 'discovered', 'declined'] },
    at: { type: 'string', format: 'date' },
    note: { type: 'string', maxLength: 2000 },
  },
} as const

type StatusBody = {
  status: 'applied' | 'interviewing' | 'skipped' | 'discovered' | 'declined'
  at?: string
  note?: string
}

/**
 * Build timestamp-set values from the transition matrix.
 *
 * | status           | applied_at | interviewing_at | declined_at | skipped_at |
 * |------------------|------------|-----------------|-------------|------------|
 * | new/discovered   | clear      | clear           | clear       | clear      |
 * | applied          | set        | clear           | clear       | clear      |
 * | interviewing     | preserve   | set             | clear       | clear      |
 * | declined         | preserve   | preserve        | set         | clear      |
 * | skipped          | clear      | clear           | clear       | set        |
 */
function transitionColumns(
  status: StatusBody['status'],
  timestamp: ReturnType<typeof sql>,
  now: ReturnType<typeof sql>,
  current: { appliedAt: string | null; interviewingAt: string | null; declinedAt: string | null }
) {
  switch (status) {
    case 'discovered':
      return { appliedAt: null, interviewingAt: null, declinedAt: null, skippedAt: null }
    case 'applied':
      return { appliedAt: timestamp, interviewingAt: null, declinedAt: null, skippedAt: null }
    case 'interviewing':
      return { appliedAt: current.appliedAt, interviewingAt: timestamp, declinedAt: null, skippedAt: null }
    case 'declined':
      return {
        appliedAt: current.appliedAt,
        interviewingAt: current.interviewingAt,
        declinedAt: timestamp,
        skippedAt: null,
      }
    case 'skipped':
      return { appliedAt: null, interviewingAt: null, declinedAt: null, skippedAt: now }
  }
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
      const current = tx
        .select({ appliedAt: jobs.appliedAt, interviewingAt: jobs.interviewingAt, declinedAt: jobs.declinedAt })
        .from(jobs)
        .where(eq(jobs.id, id))
        .get()

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

      if (updated && note && (status === 'applied' || status === 'declined' || status === 'interviewing')) {
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
