/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobs, jobStatusEvents } from 'db'
import { eq, and } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import { importJob, ProviderError, type ProvidedJob } from 'providers'

const VALID_STATUSES = ['applied', 'interviewing', 'skipped', 'declined', 'unsuccessful', 'successful'] as const

const postJobImport: FastifyPluginAsync = async app => {
  app.post('/', async (req, reply) => {
    const body = (req.body ?? {}) as { url?: string; status?: string; at?: string }

    const url = body.url
    if (typeof url !== 'string') {
      return reply.badRequest('url is required')
    }

    const status = body.status
    if (typeof status !== 'string' || !(VALID_STATUSES as readonly string[]).includes(status)) {
      return reply.badRequest('status is required and must be a valid status')
    }

    let job: ProvidedJob
    try {
      job = await importJob(url)
    } catch (err) {
      if (err instanceof ProviderError) {
        switch (err.code) {
          case 'unsupported_url':
            return reply.badRequest('URL must be a provider job URL')
          case 'fetch_failed':
            return reply.code(422).send('Could not fetch job page')
          case 'parse_failed':
            return reply.code(422).send('Could not parse job page')
          case 'job_closed':
            return reply.code(422).send('This job is no longer accepting applications')
        }
      }
      throw err
    }

    const existing = app.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.provider, job.provider), eq(jobs.providerJobId, job.providerJobId)))
      .get()
    if (existing) {
      return reply.conflict('Job already imported')
    }

    const atValue = body.at ?? new Date().toISOString().slice(0, 10)
    const isTerminal = status === 'successful' || status === 'unsuccessful' || status === 'skipped'

    const values = {
      ...job,
      status,
      ...(isTerminal ? { closedAt: atValue } : {}),
    }

    const inserted = app.db.transaction(tx => {
      const row = tx.insert(jobs).values(values).returning().get()

      tx.insert(jobStatusEvents)
        .values({
          jobId: row.id,
          status,
          occurredAt: atValue,
          actor: 'human',
          note: null,
        })
        .run()

      return row
    })

    app.publisher.publish(inserted.id, 'rank')

    return reply.code(201).send({ id: inserted.id, status, title: job.title })
  })
}

export default postJobImport
