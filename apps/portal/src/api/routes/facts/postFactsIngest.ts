/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { facts } from 'db'
import type { FastifyPluginAsync } from 'fastify'
import { rankJobDetails } from 'workers'

import { sliceResume } from '../../services/slice-resume.js'

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
    const inserts = await sliceResume(resume, client, app.log)

    if (inserts.length === 0) {
      return reply.code(422).send({ error: 'ingestion produced no facts' })
    }

    for (const f of inserts) {
      app.db.insert(facts).values(f).run()
    }

    return reply.code(201).send({ inserted: inserts.length })
  })
}

export default postFactsIngest
