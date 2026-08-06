/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobSignals, jobs, type DB } from 'db'
import { and, eq, inArray } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

const DIMENSION_KEYS = ['technical', 'experience', 'behavioral', 'career']

interface SignalTotals {
  signalCount: number
  gated: boolean
  dimensions: Record<string, number>
  baseScore: number
}

interface SummaryRouteOptions {
  db: DB
}

function signalDimension(metadata: string | null): string | null {
  if (!metadata) {
    return null
  }
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>
    if (typeof parsed.dimension === 'string' && DIMENSION_KEYS.includes(parsed.dimension)) {
      return parsed.dimension
    }
  } catch {
    // malformed metadata is ignored
  }
  return null
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

    const totals = new Map<number, SignalTotals>()
    for (const signal of signalRows) {
      const current = totals.get(signal.jobId) ?? {
        signalCount: 0,
        gated: false,
        dimensions: {},
        baseScore: 0,
      }
      current.signalCount += 1
      if (signal.signalType === 'dealbreaker') {
        current.gated = true
      } else {
        const dimension = signalDimension(signal.metadata)
        if (dimension) {
          current.dimensions[dimension] = (current.dimensions[dimension] ?? 0) + signal.score
        } else {
          current.baseScore += signal.score
        }
      }
      totals.set(signal.jobId, current)
    }

    const summary: Record<string, SignalTotals> = {}
    for (const job of rows) {
      summary[job.providerJobId] = totals.get(job.id) ?? {
        signalCount: 0,
        gated: false,
        dimensions: {},
        baseScore: 0,
      }
    }
    return summary
  })
}

export default getSummary
