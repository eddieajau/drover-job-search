/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { AnalysisQueue, Fact, Job as JobRow, JobSignal, Query, SignalRule } from 'db'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

import type { QueueSummaryResponse, QueueSummaryRow, SignalSummary } from '../shared/types.js'

export type { QueueSummaryResponse, QueueSummaryRow }

const MARKDOWN_ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'del',
  'blockquote',
  'code',
  'pre',
  'a',
  'br',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
]

const MARKDOWN_ALLOWED_ATTRIBUTES = {
  a: ['href', 'title'],
}

export function markdownToHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false })
  return sanitizeHtml(html, {
    allowedTags: MARKDOWN_ALLOWED_TAGS,
    allowedAttributes: MARKDOWN_ALLOWED_ATTRIBUTES,
  }).trim()
}

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
  signalType: string
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

export type JobStatusValue = 'new' | 'discovered' | 'applied' | 'skipped'

export interface JobResponse extends Omit<JobRow, 'description' | 'status'> {
  status: JobStatusValue
  descriptionHtml: string | null
  signals: SignalSummary
  queued: boolean
}

export function toJobJson(row: JobRow, summary?: SignalSummary, queued = false): JobResponse {
  const { description, ...rest } = row
  return {
    ...rest,
    status: row.status as JobStatusValue,
    descriptionHtml: description ? markdownToHtml(description) : null,
    signals: summary ?? { signalCount: 0, gated: false, dimensions: {}, baseScore: 0 },
    queued,
  }
}

export interface QueueResponse {
  id: number
  jobId: number | null
  topic: string
  errorMessage: string | null
  queuedAt: string
  completedAt: string | null
}

export function toQueueJson(row: AnalysisQueue): QueueResponse {
  return { ...row }
}

export interface FactResponse {
  id: number
  category: string
  label: string
  detail: string | null
  evidenceType: string | null
  startedAt: string | null
  endedAt: string | null
  period: string | null
  confidence: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export function toFactJson(row: Fact): FactResponse {
  return { ...row }
}
