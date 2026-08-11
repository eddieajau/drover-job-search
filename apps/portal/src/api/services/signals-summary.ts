/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobSignals, type DB } from 'db'
import { inArray } from 'drizzle-orm'

import type { SignalSummary } from '../../shared/types.js'

export const DIMENSION_KEYS = ['technical', 'experience', 'behavioral', 'career']

export const DIMENSION_WEIGHTS: Record<string, number> = {
  technical: 0.3,
  experience: 0.25,
  behavioral: 0.15,
  career: 0.3,
}

export function computeNetScore(dimensions: Record<string, number>, baseScore: number): number {
  let weighted = 0
  for (const [dimension, score] of Object.entries(dimensions)) {
    weighted += score * (DIMENSION_WEIGHTS[dimension] ?? 0)
  }
  return Math.round(weighted) + baseScore
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
  for (const summary of totals.values()) {
    summary.netScore = computeNetScore(summary.dimensions, summary.baseScore)
  }
  return totals
}
