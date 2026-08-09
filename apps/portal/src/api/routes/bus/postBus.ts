/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { FastifyPluginAsync } from 'fastify'

const postBus: FastifyPluginAsync = async app => {
  app.post('/', async (req, reply) => {
    const topic = (req.body as { topic?: string } | undefined)?.topic
    if (topic !== 'fetch_job_details' && topic !== 'rank') {
      return reply.badRequest('Invalid body: topic must be "fetch_job_details" or "rank"')
    }
    app.bus.emit('kick', { topic })
    app.log.info({ topic }, 'manual kick')
    return { ok: true, topic }
  })
}

export default postBus
