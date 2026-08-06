/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { AnalysisQueue, Job as JobRow, JobSignal, Query, SignalRule } from 'db'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

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

export interface JobResponse {
  id: number
  provider: string
  providerJobId: string
  title: string
  companyName: string
  url: string
  location: string
  workplaceType: string | null
  employmentType: string | null
  postedAt: string | null
  descriptionHtml: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  salaryPeriod: string | null
  isSalaryEstimated: number
  salaryRaw: string | null
  category: string
  priority: number
  status: string
  processedBy: string | null
  skipReason: string | null
  createdAt: string
  appliedAt: string | null
  skippedAt: string | null
  updatedAt: string
}

export function toJobJson(row: JobRow): JobResponse {
  const { description, ...rest } = row
  return {
    ...rest,
    descriptionHtml: description ? markdownToHtml(description) : null,
  }
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
