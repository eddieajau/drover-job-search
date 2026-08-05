/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobSignals, jobs, type DB } from 'db'
import { and, eq, inArray } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

interface SummaryRouteOptions {
  db: DB
}

const getSummary: FastifyPluginAsync<SummaryRouteOptions> = async (app, { db }) => {
  app.get('/', async (req, reply) => {
    const { provider, ids } = req.query as { provider?: string; ids?: string }

    const providerName = provider ?? 'linkedin'
    const idList = (ids ?? '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
    if (idList.length === 0) {
      return reply.badRequest('Invalid query parameter: ids')
    }

    const rows = db
      .select()
      .from(jobs)
      .where(and(eq(jobs.provider, providerName), inArray(jobs.providerJobId, idList)))
      .all()
    if (rows.length === 0) {
      return {}
    }

    const jobIds = rows.map(job => job.id)
    const signalRows = db.select().from(jobSignals).where(inArray(jobSignals.jobId, jobIds)).all()

    const totals = new Map<number, { netScore: number; signalCount: number }>()
    for (const signal of signalRows) {
      const current = totals.get(signal.jobId) ?? { netScore: 0, signalCount: 0 }
      current.netScore += signal.score
      current.signalCount += 1
      totals.set(signal.jobId, current)
    }

    const summary: Record<string, { netScore: number; signalCount: number }> = {}
    for (const job of rows) {
      summary[job.providerJobId] = totals.get(job.id) ?? { netScore: 0, signalCount: 0 }
    }
    return summary
  })
}

export default getSummary
