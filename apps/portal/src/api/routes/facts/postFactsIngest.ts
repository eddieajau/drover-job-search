/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { facts } from 'db'
import { eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import { rankJobDetails, sliceResume } from 'workers'

const bodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['resume'],
  properties: {
    resume: { type: 'string', minLength: 1 },
  },
} as const

const postFactsIngest: FastifyPluginAsync = async app => {
  app.post('/ingest', { schema: { body: bodySchema } }, async (req, reply) => {
    const { resume } = req.body as { resume: string }

    const client = rankJobDetails.createOllamaClient(process.env.OLLAMA_BASE_URL, process.env.OLLAMA_MODEL, app.log)
    const existing = app.db.select().from(facts).where(eq(facts.active, true)).all()
    const proposed = await sliceResume.sliceResume(resume, client, app.log)
    const { inserts, superseded } = sliceResume.mergeFacts(existing, proposed)

    if (inserts.length === 0) {
      return reply.code(422).send({ error: 'ingestion produced no facts' })
    }

    for (const f of inserts) {
      app.db.insert(facts).values(f).run()
    }

    for (const id of superseded) {
      app.db.update(facts).set({ active: false }).where(eq(facts.id, id)).run()
    }

    return reply.code(201).send({ inserted: inserts.length })
  })
}

export default postFactsIngest
