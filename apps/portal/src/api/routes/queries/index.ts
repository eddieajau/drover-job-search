/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { FastifyPluginAsync } from 'fastify'
import { asc, eq } from 'drizzle-orm'
import { queries, type DB } from 'db'
import { toQueryJson } from '../../serializers.js'

interface QueriesRouteOptions {
  db: DB
}

const getQueries: FastifyPluginAsync<QueriesRouteOptions> = async (app, { db }) => {
  app.get('/', async (req, reply) => {
    const { id } = req.query as { id?: string }

    if (id !== undefined) {
      const queryId = Number.parseInt(id, 10)
      if (!Number.isInteger(queryId) || queryId <= 0) {
        return reply.badRequest('Invalid query parameter: id')
      }
      const row = db.select().from(queries).where(eq(queries.id, queryId)).get()
      if (!row) {
        return reply.notFound(`Query ${queryId} not found`)
      }
      return toQueryJson(row)
    }

    const rows = db.select().from(queries).orderBy(asc(queries.id)).all()
    return rows.map(toQueryJson)
  })
}

export default getQueries
