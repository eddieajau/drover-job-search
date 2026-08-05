/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Job, JobStatus } from '../shared/types.js'

export type JobWithStatus = Job & { _status: JobStatus['status'] }

export interface JobsFilters {
  priority: string
  status: string
  search: string
}

export interface JobsViewState {
  status: 'idle' | 'loading' | 'error' | 'done'
  message: string
  all: JobWithStatus[]
  jobs: JobWithStatus[]
  filters: JobsFilters
  selectedId: string | null
}
