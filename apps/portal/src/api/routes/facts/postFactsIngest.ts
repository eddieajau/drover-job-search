/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { documents } from 'db'
import type { FastifyPluginAsync } from 'fastify'
import { attachInputDoc, enqueueTask } from 'workers'

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

    const taskId = enqueueTask(app.db, { topic: 'slice_resume' })
    const docId = `slice_resume/${taskId}/input`
    app.db.insert(documents).values({ id: docId, payload: resume }).run()
    attachInputDoc(app.db, taskId, docId)
    app.bus.emit('kick', { topic: 'slice_resume' })

    return reply.code(202).send({ taskId })
  })
}

export default postFactsIngest
