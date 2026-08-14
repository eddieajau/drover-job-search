/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobs } from 'db'
import { and, eq, sql } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import type { AnalysisTopic } from 'workers'

const DEFAULT_TOPIC: AnalysisTopic = 'fetch_job_details'
// VALID_TOPICS admits run_signal_rules so the guard below can give it a
// specific rejection; a per-job publish can never express a sweep row.
const VALID_TOPICS: ReadonlySet<AnalysisTopic> = new Set(['fetch_job_details', 'rank', 'run_signal_rules'])

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
    const body = (req.body ?? {}) as { topic?: AnalysisTopic; topics?: AnalysisTopic[] }
    let topics: AnalysisTopic[]
    if (body.topics) {
      topics = body.topics
    } else if (body.topic) {
      topics = [body.topic]
    } else {
      topics = [DEFAULT_TOPIC]
    }

    // Sweep topics are not per-job: a sweep row carries jobId = null, which a
    // per-job publish cannot express. Reject rather than silently mis-enqueue.
    if (topics.includes('run_signal_rules')) {
      return reply.badRequest('run_signal_rules is a sweep topic; use the CLI')
    }

    for (const topic of topics) {
      if (!VALID_TOPICS.has(topic)) {
        return reply.badRequest('Invalid topic')
      }
    }

    app.publisher.publishMany(jobId, topics)
    if (topics.includes('fetch_job_details')) {
      app.db
        .update(jobs)
        .set({ status: 'discovered', updatedAt: sql`(CURRENT_TIMESTAMP)` })
        .where(and(eq(jobs.id, jobId), eq(jobs.status, 'new')))
        .run()
    }
    return reply.code(202).send()
  })
}

export default postJobFlag
