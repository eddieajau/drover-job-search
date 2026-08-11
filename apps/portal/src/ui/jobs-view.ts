/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Job, JobStatus } from '../shared/types.js'

export type JobWithStatus = Job & { _status: JobStatus['status']; netScore?: number; gated?: boolean }

export type JobSortKey = 'score' | 'posted' | 'company'

export interface JobsFilters {
  status: string
  search: string
  score: string
  sort: JobSortKey
}

export interface JobsViewState {
  status: 'idle' | 'loading' | 'error' | 'done'
  message: string
  all: JobWithStatus[]
  jobs: JobWithStatus[]
  filters: JobsFilters
  selectedId: number | null
  page: number
  pageSize: number
  total: number
}
