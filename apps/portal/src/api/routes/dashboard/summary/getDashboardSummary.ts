/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs, jobStatusEvents } from 'db'
import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import type { DashboardSummary } from '../../../../shared/types.js'

function windowStart(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00Z`
}

const getDashboardSummary: FastifyPluginAsync = async app => {
  app.get('/', async req => {
    const raw = Number((req.query as { days?: string }).days)
    const days = Math.min(Math.max(Number.isFinite(raw) ? raw : 14, 1), 30)
    const now = new Date()
    const windowFrom = windowStart(days)
    const priorFrom = windowStart(days * 2)
    const priorTo = windowFrom
    const stuckCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    const [appliedCount] = app.db
      .select({ count: sql<number>`count(*)` })
      .from(jobStatusEvents)
      .where(and(eq(jobStatusEvents.status, 'applied'), gte(jobStatusEvents.occurredAt, windowFrom)))
      .all()

    const [priorAppliedCount] = app.db
      .select({ count: sql<number>`count(*)` })
      .from(jobStatusEvents)
      .where(
        and(
          eq(jobStatusEvents.status, 'applied'),
          gte(jobStatusEvents.occurredAt, priorFrom),
          lt(jobStatusEvents.occurredAt, priorTo)
        )
      )
      .all()

    const [interviewingCount] = app.db
      .select({ count: sql<number>`count(*)` })
      .from(jobStatusEvents)
      .where(and(eq(jobStatusEvents.status, 'interviewing'), gte(jobStatusEvents.occurredAt, windowFrom)))
      .all()

    const inFlightRows = app.db
      .select({ status: jobs.status, count: sql<number>`count(*)` })
      .from(jobs)
      .where(and(sql`jobs.status IN ('applied', 'interviewing')`))
      .groupBy(jobs.status)
      .all()

    const inFlight = { applied: 0, interviewing: 0 }
    for (const row of inFlightRows) {
      if (row.status === 'applied') inFlight.applied = row.count
      if (row.status === 'interviewing') inFlight.interviewing = row.count
    }

    const pipelineRows = app.db
      .select({ status: jobs.status, count: sql<number>`count(*)` })
      .from(jobs)
      .where(sql`jobs.status IN ('applied', 'interviewing', 'successful', 'unsuccessful', 'declined')`)
      .groupBy(jobs.status)
      .all()

    const pipeline = { applied: 0, interviewing: 0, successful: 0, unsuccessful: 0, declined: 0 }
    for (const row of pipelineRows) {
      if (row.status in pipeline) {
        ;(pipeline as Record<string, number>)[row.status] = row.count
      }
    }

    const [discoveredMissing] = app.db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(and(eq(jobs.status, 'discovered'), isNull(jobs.description)))
      .all()

    const [stuckQueue] = app.db
      .select({ count: sql<number>`count(*)` })
      .from(analysisQueue)
      .where(and(isNull(analysisQueue.completedAt), lt(analysisQueue.queuedAt, stuckCutoff)))
      .all()

    const attention: DashboardSummary['attention'] = []
    if (discoveredMissing.count > 0) {
      attention.push({
        kind: 'discovered_missing',
        message: `${discoveredMissing.count} discovered job${discoveredMissing.count === 1 ? '' : 's'} missing details`,
        detail: 'These jobs are in the fetch queue but have no description yet.',
      })
    }
    if (stuckQueue.count > 0) {
      attention.push({
        kind: 'queue_stuck',
        message: `${stuckQueue.count} queue item${stuckQueue.count === 1 ? '' : 's'} stuck (>24h)`,
        detail: 'These items have been queued for over 24 hours without completion.',
      })
    }

    const count = appliedCount.count
    const interviewRate = count === 0 ? 0 : Math.round((interviewingCount.count / count) * 100)

    const result: DashboardSummary = {
      applied: { count, delta: count - priorAppliedCount.count },
      inFlight,
      interviewRate,
      pipeline,
      attention,
    }
    return result
  })
}

export default getDashboardSummary
