/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export interface SignalSummary {
  signalCount: number
  gated: boolean
  dimensions: Record<string, number>
  baseScore: number
  netScore?: number
}

export interface Job {
  id: number
  provider: string
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
  closedAt: string | null
  signals?: SignalSummary
  queued?: boolean
}

export interface JobStatus {
  id: number
  status:
    | 'new'
    | 'discovered'
    | 'applied'
    | 'interviewing'
    | 'skipped'
    | 'blocked'
    | 'declined'
    | 'unsuccessful'
    | 'successful'
  date: string
}

export interface JobNote {
  id: number
  jobId: number
  kind: 'applied' | 'declined' | 'interviewing' | 'general' | 'unsuccessful' | 'successful'
  note: string
  createdAt: string
  updatedAt: string
}

export interface QueryOptions {
  location?: string
  workType?: string
  jobType?: string
  /** Explicit strict target (comma-list of remote, hybrid, onsite) or 'off'.
   * Defaults to `workType`, which is always verified from each job's listing
   * because LinkedIn's workType facet is leaky. */
  strictWorkType?: string
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
  topic: 'fetch_job_details' | 'rank'
  queuedAt: string
  completedAt: string | null
}

export interface QueueSummaryResponse {
  pending: { fetch_job_details: number; rank: number }
  done: number
  total: number
  recent: QueueSummaryRow[]
}

export interface TaskStatus {
  id: number
  topic: string
  queuedAt: string
  completedAt: string | null
  errorMessage: string | null
  result: { inserted?: number; superseded?: number } | null
}

export interface ApplicationDay {
  day: string
  count: number
}

export interface ApplicationsChart {
  days: ApplicationDay[]
}

export interface DashboardSummary {
  applied: { count: number; delta: number }
  inFlight: { applied: number; interviewing: number }
  interviewRate: number
  pipeline: {
    applied: number
    interviewing: number
    successful: number
    unsuccessful: number
    declined: number
  }
  attention: Array<{ kind: string; message: string; detail: string }>
}

export type { FactResponse } from '../api/serializers.js'
