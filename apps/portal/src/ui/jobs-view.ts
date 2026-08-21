/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Job, JobStatus } from '../shared/types.js'

export type JobWithStatus = Job & { _status: JobStatus['status']; netScore?: number; gated?: boolean }

export type JobSortKey = 'score' | 'posted' | 'company' | 'applied'

export interface JobsFilters {
  status:
    | 'all'
    | 'new'
    | 'discovered'
    | 'applied'
    | 'interviewing'
    | 'skipped'
    | 'blocked'
    | 'declined'
    | 'unsuccessful'
    | 'successful'
  search: string
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
