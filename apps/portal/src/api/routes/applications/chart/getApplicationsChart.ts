/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobStatusEvents } from 'db'
import { and, eq, gte } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

import type { ApplicationsChart } from '../../../../shared/types.js'

function localDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysBack(n: number): string[] {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - (n - 1))
  const result: string[] = []
  const cursor = new Date(start)
  while (cursor <= today) {
    result.push(localDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

const getApplicationsChart: FastifyPluginAsync = async app => {
  app.get('/', async req => {
    const { days: rawDays } = req.query as { days?: string }
    const raw = Number(rawDays)
    const days = daysBack(Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 30) : 14)
    const windowStart = `${days[0]}T00:00:00Z`

    const rows = app.db
      .select({ occurredAt: jobStatusEvents.occurredAt })
      .from(jobStatusEvents)
      .where(and(eq(jobStatusEvents.status, 'applied'), gte(jobStatusEvents.occurredAt, windowStart)))
      .all()

    const counts = new Map<string, number>()
    for (const day of days) {
      counts.set(day, 0)
    }
    for (const row of rows) {
      const day = row.occurredAt.slice(0, 10)
      const prev = counts.get(day)
      if (prev !== undefined) {
        counts.set(day, prev + 1)
      }
    }

    const result: ApplicationsChart = {
      days: days.map(day => ({ day, count: counts.get(day) ?? 0 })),
    }
    return result
  })
}

export default getApplicationsChart
