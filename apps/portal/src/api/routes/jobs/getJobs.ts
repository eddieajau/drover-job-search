/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs } from 'db'
import { count, desc, like, inArray, or } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import { toJobJson } from '../../serializers.js'
import { summariseSignals } from '../../services/signals-summary.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const getJobs: FastifyPluginAsync = async app => {
  app.get('/', async req => {
    const { limit, offset, q } = req.query as { limit?: string; offset?: string; q?: string }

    const parsedLimit = Number.parseInt(limit ?? '', 10)
    const pageLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, MAX_LIMIT) : DEFAULT_LIMIT

    const parsedOffset = Number.parseInt(offset ?? '', 10)
    const pageOffset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0

    const searchTerm = q?.trim() ?? ''
    const searchCondition = searchTerm
      ? or(like(jobs.title, `%${searchTerm}%`), like(jobs.companyName, `%${searchTerm}%`))
      : undefined

    let total: number
    if (searchCondition) {
      const [row] = await app.db.select({ total: count() }).from(jobs).where(searchCondition)
      total = row.total
    } else {
      const [row] = await app.db.select({ total: count() }).from(jobs)
      total = row.total
    }

    let results
    if (searchCondition) {
      results = await app.db
        .select()
        .from(jobs)
        .where(searchCondition)
        .orderBy(desc(jobs.postedAt), desc(jobs.id))
        .limit(pageLimit)
        .offset(pageOffset)
    } else {
      results = await app.db
        .select()
        .from(jobs)
        .orderBy(desc(jobs.postedAt), desc(jobs.id))
        .limit(pageLimit)
        .offset(pageOffset)
    }

    const totals = summariseSignals(
      app.db,
      results.map(row => row.id)
    )

    const queuedIds = new Set<number>()
    if (results.length > 0) {
      const queueRows = app.db
        .select({ jobId: analysisQueue.jobId })
        .from(analysisQueue)
        .where(
          inArray(
            analysisQueue.jobId,
            results.map(row => row.id)
          )
        )
        .all()
      for (const row of queueRows) {
        queuedIds.add(row.jobId)
      }
    }

    return {
      count: total,
      limit: pageLimit,
      offset: pageOffset,
      results: results.map(row => toJobJson(row, totals.get(row.id), queuedIds.has(row.id))),
    }
  })
}

export default getJobs
