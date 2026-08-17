/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs, type Job } from 'db'
import { and, desc, eq, inArray, like, or } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import type { SignalSummary } from '../../../shared/types.js'
import { toJobJson } from '../../serializers.js'
import { summariseSignals } from '../../services/signals-summary.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const HOT_THRESHOLD = 50

const VALID_STATUSES = new Set([
  'new',
  'discovered',
  'applied',
  'interviewing',
  'skipped',
  'blocked',
  'declined',
  'unsuccessful',
  'successful',
])
const VALID_SCORES = new Set(['scorable', 'hot', 'lukewarm', 'blocked'])

function emptySummary(): SignalSummary {
  return { signalCount: 0, gated: false, dimensions: {}, baseScore: 0, netScore: 0 }
}

function matchesScore(score: string, summary: SignalSummary | undefined): boolean {
  const s = summary ?? emptySummary()
  switch (score) {
    case 'hot':
      return !s.gated && (s.netScore ?? 0) >= HOT_THRESHOLD
    case 'lukewarm':
      return !s.gated && (s.netScore ?? 0) < HOT_THRESHOLD
    case 'blocked':
      return s.gated
    case 'scorable':
      return !s.gated
    default:
      return true
  }
}

const getJobs: FastifyPluginAsync = async app => {
  app.get('/', async req => {
    const { limit, offset, q, status, score } = req.query as {
      limit?: string
      offset?: string
      q?: string
      status?: string
      score?: string
    }

    const parsedLimit = Number.parseInt(limit ?? '', 10)
    const pageLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, MAX_LIMIT) : DEFAULT_LIMIT

    const parsedOffset = Number.parseInt(offset ?? '', 10)
    const pageOffset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0

    const searchTerm = q?.trim() ?? ''
    const searchCondition = searchTerm
      ? or(like(jobs.title, `%${searchTerm}%`), like(jobs.companyName, `%${searchTerm}%`))
      : undefined

    const conditions = []
    if (searchCondition) {
      conditions.push(searchCondition)
    }
    if (status && VALID_STATUSES.has(status)) {
      // status=blocked filters by stored jobs.status column; score=blocked (below) filters by derived gated summary
      conditions.push(eq(jobs.status, status))
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const idRows = await app.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(where)
      .orderBy(desc(jobs.postedAt), desc(jobs.id))

    const totals = summariseSignals(
      app.db,
      idRows.map(row => row.id)
    )

    let ids = idRows.map(row => row.id)
    if (score && VALID_SCORES.has(score)) {
      ids = ids.filter(id => matchesScore(score, totals.get(id)))
    }
    const total = ids.length

    const pageIds = ids.slice(pageOffset, pageOffset + pageLimit)

    let results: Job[] = []
    if (pageIds.length > 0) {
      results = await app.db
        .select()
        .from(jobs)
        .where(inArray(jobs.id, pageIds))
        .orderBy(desc(jobs.postedAt), desc(jobs.id))
    } else {
      results = []
    }

    const queuedIds = new Set<number>()
    if (pageIds.length > 0) {
      const queueRows = app.db
        .select({ jobId: analysisQueue.jobId })
        .from(analysisQueue)
        .where(inArray(analysisQueue.jobId, pageIds))
        .all()
      for (const row of queueRows) {
        if (row.jobId !== null) queuedIds.add(row.jobId)
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
