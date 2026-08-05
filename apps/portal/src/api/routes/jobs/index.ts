/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobs, type DB } from 'db'
import { count, desc } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

interface JobsRouteOptions {
  db: DB
}

const getJobs: FastifyPluginAsync<JobsRouteOptions> = async (app, { db }) => {
  app.get('/', async req => {
    const { limit, offset } = req.query as { limit?: string; offset?: string }

    const parsedLimit = Number.parseInt(limit ?? '', 10)
    const pageLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, MAX_LIMIT) : DEFAULT_LIMIT

    const parsedOffset = Number.parseInt(offset ?? '', 10)
    const pageOffset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0

    const [{ total }] = await db.select({ total: count() }).from(jobs)
    const results = await db
      .select()
      .from(jobs)
      .orderBy(desc(jobs.postedAt), desc(jobs.id))
      .limit(pageLimit)
      .offset(pageOffset)

    return { count: total, limit: pageLimit, offset: pageOffset, results }
  })
}

export default getJobs
