/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export interface Job {
  id: string
  title: string
  company: string
  url: string
  location: string
  date: string
  description?: string
  salary?: string
  priority: number
  category: string
}

export interface JobStatus {
  id: string
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
