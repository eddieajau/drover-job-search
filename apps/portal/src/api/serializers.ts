/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { AnalysisQueue, JobSignal, Query, SignalRule } from 'db'

export function parseQueryOptions(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) {
    return undefined
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return undefined
  }
}

export interface QueryResponse {
  id: number
  provider: string
  queryText: string
  queryOptions?: Record<string, unknown>
  enabled: boolean | null
  createdAt: string
}

export function toQueryJson(row: Query): QueryResponse {
  const { queryOptions, ...rest } = row
  return { ...rest, queryOptions: parseQueryOptions(queryOptions) }
}

export interface RuleResponse {
  id: number
  ruleName: string
  ruleCategory: string
  pattern: string
  scoreModifier: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export function toRuleJson(row: SignalRule): RuleResponse {
  return { ...row }
}

export interface SignalResponse {
  id: number
  jobId: number
  ruleId: number | null
  source: string
  signalType: string
  score: number
  metadata?: Record<string, unknown>
  createdAt: string
}

export function toSignalJson(row: JobSignal): SignalResponse {
  const { metadata, ...rest } = row
  return { ...rest, metadata: parseQueryOptions(metadata) }
}

export interface QueueResponse {
  id: number
  jobId: number
  queuedAt: string
  completedAt: string | null
}

export function toQueueJson(row: AnalysisQueue): QueueResponse {
  return { ...row }
}
