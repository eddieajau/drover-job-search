/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { tasks } from 'db'
import { eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

const getTask: FastifyPluginAsync = async app => {
  app.get('/', async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) {
      return reply.badRequest('Invalid task id')
    }
    const row = app.db.select().from(tasks).where(eq(tasks.id, id)).get()
    if (!row) {
      return reply.notFound(`Task ${id} not found`)
    }
    return {
      id: row.id,
      topic: row.topic,
      queuedAt: row.queuedAt,
      completedAt: row.completedAt,
      errorMessage: row.errorMessage,
      result: row.result ? (JSON.parse(row.result) as Record<string, unknown>) : null,
    }
  })
}

export default getTask
