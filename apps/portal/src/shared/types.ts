/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export interface Job {
  id: number
  providerJobId: string
  title: string
  companyName: string
  url: string
  location: string
  postedAt: string | null
  description?: string | null
  salaryRaw?: string | null
  priority: number
  category: string
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

export interface SignalRule {
  id: number
  ruleName: string
  ruleCategory: RuleCategory
  pattern: string
  scoreModifier: number
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
