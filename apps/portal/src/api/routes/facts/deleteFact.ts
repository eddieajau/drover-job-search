/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { facts } from 'db'
import { eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

const deleteFact: FastifyPluginAsync = async app => {
  app.delete('/:id', async (req, reply) => {
    const factId = Number.parseInt((req.params as { id: string }).id, 10)
    if (!Number.isInteger(factId) || factId <= 0) {
      return reply.badRequest('Invalid path parameter: id')
    }

    const existing = app.db.select().from(facts).where(eq(facts.id, factId)).get()
    if (!existing) {
      return reply.notFound(`Fact ${factId} not found`)
    }

    app.db.delete(facts).where(eq(facts.id, factId)).run()
    return reply.code(204).send()
  })
}

export default deleteFact
