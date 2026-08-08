/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { FastifyPluginAsync } from 'fastify'

const postBus: FastifyPluginAsync = async app => {
  app.post('/', async (req, reply) => {
    const event = (req.body as { event?: string } | undefined)?.event
    if (event !== 'flagged' && event !== 'descriptions-ready') {
      return reply.badRequest('Invalid body: event must be "flagged" or "descriptions-ready"')
    }
    app.bus.emit(event, { jobId: 0 })
    app.log.info({ event }, 'manual kick')
    return { ok: true, event }
  })
}

export default postBus
