/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { queries } from 'db'
import { eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toQueryJson } from '../../serializers.js'

interface QueryOptionsBody {
  location?: string
  workType?: string
  jobType?: string
}

interface QueryBody {
  id?: number
  provider?: string
  queryText: string
  queryOptions?: QueryOptionsBody
  enabled?: boolean
}

const bodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['queryText'],
  properties: {
    id: { type: 'integer' },
    provider: { type: 'string' },
    queryText: { type: 'string', minLength: 1 },
    queryOptions: {
      type: 'object',
      additionalProperties: false,
      properties: {
        location: { type: 'string' },
        workType: { type: 'string' },
        jobType: { type: 'string' },
      },
    },
    enabled: { type: 'boolean' },
  },
} as const

const postQuery: FastifyPluginAsync = async app => {
  app.post('/', { schema: { body: bodySchema } }, async (req, reply) => {
    const { id, provider, queryText, queryOptions, enabled } = req.body as QueryBody

    if (id !== undefined) {
      const existing = app.db.select().from(queries).where(eq(queries.id, id)).get()
      if (!existing) {
        return reply.notFound(`Query ${id} not found`)
      }

      const values: Partial<typeof queries.$inferInsert> = { queryText }
      if (provider !== undefined) {
        values.provider = provider
      }
      if (queryOptions !== undefined) {
        values.queryOptions = JSON.stringify(queryOptions)
      }
      if (enabled !== undefined) {
        values.enabled = enabled
      }

      app.db.update(queries).set(values).where(eq(queries.id, id)).run()

      const row = app.db.select().from(queries).where(eq(queries.id, id)).get()
      if (!row) {
        return reply.internalServerError('Failed to reload query')
      }
      return toQueryJson(row)
    }

    const row = app.db
      .insert(queries)
      .values({
        provider: provider ?? 'linkedin',
        queryText,
        queryOptions: queryOptions !== undefined ? JSON.stringify(queryOptions) : undefined,
        enabled: enabled ?? true,
      })
      .returning()
      .get()

    return reply.code(201).send(toQueryJson(row))
  })
}

export default postQuery
