/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { FastifyPluginAsync } from 'fastify'

const postBus: FastifyPluginAsync = async app => {
  app.post('/', async (req, reply) => {
    const stage = (req.body as { stage?: string } | undefined)?.stage
    if (stage !== 'fetch_job_details' && stage !== 'rank') {
      return reply.badRequest('Invalid body: stage must be "fetch_job_details" or "rank"')
    }
    app.bus.emit('kick', { stage })
    app.log.info({ stage }, 'manual kick')
    return { ok: true, stage }
  })
}

export default postBus
