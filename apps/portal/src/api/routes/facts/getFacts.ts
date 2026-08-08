/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { facts } from 'db'
import { and, asc, eq, like, or } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toFactJson } from '../../serializers.js'

const VALID_CATEGORIES = ['skill', 'role', 'precedent_story', 'gap', 'credential', 'principle'] as const

const getFacts: FastifyPluginAsync = async app => {
  app.get('/', async (req, reply) => {
    const { id, category, active, q } = req.query as {
      id?: string
      category?: string
      active?: string
      q?: string
    }

    if (id !== undefined) {
      const factId = Number.parseInt(id, 10)
      if (!Number.isInteger(factId) || factId <= 0) {
        return reply.badRequest('Invalid query parameter: id')
      }
      const row = app.db.select().from(facts).where(eq(facts.id, factId)).get()
      if (!row) {
        return reply.notFound(`Fact ${factId} not found`)
      }
      return toFactJson(row)
    }

    if (category !== undefined && !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
      return reply.badRequest(`Invalid category: ${category}`)
    }

    const conditions: ReturnType<typeof eq>[] = []

    if (category !== undefined) {
      conditions.push(eq(facts.category, category))
    }

    if (active !== undefined) {
      if (active !== '0' && active !== '1') {
        return reply.badRequest('Invalid query parameter: active')
      }
      conditions.push(eq(facts.active, active === '1'))
    }

    if (q !== undefined) {
      const pattern = `%${q}%`
      conditions.push(or(like(facts.label, pattern), like(facts.detail, pattern))!)
    }

    let query = app.db.select().from(facts)

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query
    }

    const rows = query.orderBy(asc(facts.id)).all()
    return rows.map(toFactJson)
  })
}

export default getFacts
