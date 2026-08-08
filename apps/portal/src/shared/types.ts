/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export interface SignalSummary {
  signalCount: number
  gated: boolean
  dimensions: Record<string, number>
  baseScore: number
}

export interface Job {
  id: number
  providerJobId: string
  title: string
  companyName: string
  url: string
  location: string
  postedAt: string | null
  descriptionHtml: string | null
  salaryRaw?: string | null
  priority: number
  category: string
  status: string
  signals?: SignalSummary
  queued?: boolean
}

export interface JobStatus {
  id: number
  status: 'new' | 'applied' | 'skipped' | 'evaluated'
  date: string
}

export interface QueryOptions {
  location?: string
  workType?: string
  jobType?: string
}

export interface Query {
  id: number
  provider: string
  queryText: string
  queryOptions?: QueryOptions
  enabled: boolean
  createdAt: string
}

export interface SearchResult {
  id: string
  title: string
  company: string
  url: string
  location: string
  date: string
  description?: string
  salary?: string
}

export type RuleCategory = 'regex_title' | 'regex_company' | 'regex_description'

export type SignalType = 'dealbreaker' | 'skill_match' | 'company_match'

export interface SignalRule {
  id: number
  ruleName: string
  ruleCategory: RuleCategory
  pattern: string
  signalType: SignalType
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type SignalSource = 'regex_title' | 'regex_company' | 'regex_description' | 'manual_review' | 'llm_deep_eval'

export interface JobSignal {
  id: number
  jobId: number
  ruleId: number | null
  source: SignalSource
  signalType: string
  score: number
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface AnalysisQueueRow {
  id: number
  jobId: number
  queuedAt: string
  completedAt: string | null
}

export interface QueueSummaryRow {
  id: number
  jobId: number
  title: string
  companyName: string
  providerJobId: string
  stage: 'fetch_job_details' | 'rank'
  queuedAt: string
  completedAt: string | null
}

export interface QueueSummaryResponse {
  pending: { fetch_job_details: number; rank: number }
  done: number
  total: number
  recent: QueueSummaryRow[]
}

export type { FactResponse } from '../api/serializers.js'
