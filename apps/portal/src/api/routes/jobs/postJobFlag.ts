/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobs } from 'db'
import { eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import type { AnalysisTopic } from 'workers'

const DEFAULT_TOPIC: AnalysisTopic = 'fetch_job_details'
const VALID_TOPICS: ReadonlySet<AnalysisTopic> = new Set(['fetch_job_details', 'rank'])

const postJobFlag: FastifyPluginAsync = async app => {
  app.post('/:jobId/flag', async (req, reply) => {
    const jobId = Number((req.params as { jobId: string }).jobId)
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return reply.badRequest('Invalid job id')
    }
    const job = app.db.select().from(jobs).where(eq(jobs.id, jobId)).get()
    if (!job) {
      return reply.notFound(`Job ${jobId} not found`)
    }
    const body = (req.body ?? {}) as { topic?: string }
    const topic = (body.topic ?? DEFAULT_TOPIC) as AnalysisTopic
    if (!VALID_TOPICS.has(topic)) {
      return reply.badRequest('Invalid topic')
    }
    app.publisher.publish(jobId, topic)
    return reply.code(202).send()
  })
}

export default postJobFlag
