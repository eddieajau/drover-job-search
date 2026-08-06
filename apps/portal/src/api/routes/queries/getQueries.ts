/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { queries } from 'db'
import { asc, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toQueryJson } from '../../serializers.js'

const getQueries: FastifyPluginAsync = async app => {
  app.get('/', async (req, reply) => {
    const { id } = req.query as { id?: string }

    if (id !== undefined) {
      const queryId = Number.parseInt(id, 10)
      if (!Number.isInteger(queryId) || queryId <= 0) {
        return reply.badRequest('Invalid query parameter: id')
      }
      const row = app.db.select().from(queries).where(eq(queries.id, queryId)).get()
      if (!row) {
        return reply.notFound(`Query ${queryId} not found`)
      }
      return toQueryJson(row)
    }

    const rows = app.db.select().from(queries).orderBy(asc(queries.id)).all()
    return rows.map(toQueryJson)
  })
}

export default getQueries
