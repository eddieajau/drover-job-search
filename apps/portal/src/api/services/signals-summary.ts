/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobSignals, type DB } from 'db'
import { inArray } from 'drizzle-orm'

import type { SignalSummary } from '../../shared/types.js'

export const DIMENSION_KEYS = ['technical', 'experience', 'behavioral', 'career']

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

export function summariseSignals(db: DB, jobIds: number[]): Map<number, SignalSummary> {
  const totals = new Map<number, SignalSummary>()
  if (jobIds.length === 0) {
    return totals
  }
  const signalRows = db.select().from(jobSignals).where(inArray(jobSignals.jobId, jobIds)).all()

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
  return totals
}
