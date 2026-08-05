/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Job, JobStatus, Query, SearchResult } from '../shared/types.js'
import type { JobsFilters, JobsViewState, JobWithStatus } from './jobs-view.js'

type ViewStatus = 'idle' | 'loading' | 'error' | 'done'
type SeenMap = Record<string, Omit<JobStatus, 'id'>>

const JOBAGE = 14

let registered = false

let results: Job[] = []
let seen: SeenMap = {}
let selectedId: string | null = null
let filters: JobsFilters = { priority: '', status: '', search: '' }
let viewStatus: ViewStatus = 'idle'
let message = ''

export function initJobsMediator(): void {
  if (registered) {
    return
  }
  registered = true
  window.addEventListener('jobs-page:ready', handleReady)
  window.addEventListener('jobs-page:search', handleSearch)
  window.addEventListener('job-list:select', handleSelect)
  window.addEventListener('job-list:status', handleStatus)
  window.addEventListener('job-detail:status', handleStatus)
  window.addEventListener('filter-bar:change', handleFilterChange)
}

export function _resetJobsMediatorForTesting(): void {
  if (registered) {
    window.removeEventListener('jobs-page:ready', handleReady)
    window.removeEventListener('jobs-page:search', handleSearch)
    window.removeEventListener('job-list:select', handleSelect)
    window.removeEventListener('job-list:status', handleStatus)
    window.removeEventListener('job-detail:status', handleStatus)
    window.removeEventListener('filter-bar:change', handleFilterChange)
  }
  registered = false
  results = []
  seen = {}
  selectedId = null
  filters = { priority: '', status: '', search: '' }
  viewStatus = 'idle'
  message = ''
}

function handleReady(): void {
  pushState()
}

async function handleSearch(): Promise<void> {
  const page = document.querySelector('jobs-page')
  if (!page) {
    return
  }
  viewStatus = 'loading'
  page.setLoading()
  try {
    const queries = await loadEnabledQueries()
    const fresh: Job[] = []
    for (const query of queries) {
      try {
        const params = new URLSearchParams({
          q: query.queryText,
          location: query.queryOptions?.location ?? '',
          jobage: String(JOBAGE),
          pages: '3',
        })
        if (query.queryOptions?.workType) {
          params.set('workType', query.queryOptions.workType)
        }
        if (query.queryOptions?.jobType) {
          params.set('jobType', query.queryOptions.jobType)
        }
        const response = await fetch(`/api/search?${params.toString()}`)
        if (response.ok) {
          const data = (await response.json()) as { results?: SearchResult[] }
          for (const job of data.results ?? []) {
            fresh.push({ ...job, priority: 0, category: 'General' })
          }
        }
      } catch {
        // Skip failed queries
      }
    }

    const deduped = Array.from(new Map(fresh.map(job => [job.id, job])).values())
    results = mergeResults(results, deduped)
    viewStatus = 'done'
    message = ''
    pushState()
  } catch {
    viewStatus = 'error'
    message = 'Failed to load. Is the server running?'
    pushState()
  }
}

async function loadEnabledQueries(): Promise<Query[]> {
  const response = await fetch('/api/queries')
  if (!response.ok) {
    throw new Error('Failed to load queries')
  }
  const queries = (await response.json()) as Query[]
  return queries.filter(query => query.enabled)
}

function mergeResults(existing: Job[], incoming: Job[]): Job[] {
  const byId = new Map<string, Job>(existing.map(job => [job.id, job]))
  for (const job of incoming) {
    byId.set(job.id, job)
  }
  return Array.from(byId.values())
}

function handleSelect(event: Event): void {
  const { jobId } = (event as CustomEvent<{ jobId: string }>).detail
  selectedId = jobId
  pushState()
}

function handleStatus(event: Event): void {
  const detail = (event as CustomEvent<{ jobId: string; status: JobStatus['status'] }>).detail
  track(detail.jobId, detail.status)
}

function handleFilterChange(event: Event): void {
  filters = (event as CustomEvent<JobsFilters>).detail
  pushState()
}

function track(id: string, status: JobStatus['status']): void {
  if (status === 'new') {
    delete seen[id]
  } else {
    seen[id] = { status, date: new Date().toISOString().slice(0, 10) }
  }
  pushState()
}

function pushState(): void {
  const page = document.querySelector('jobs-page')
  if (!page) {
    return
  }
  const all: JobWithStatus[] = results.map(job => ({ ...job, _status: seen[job.id]?.status ?? 'new' }))

  let jobs = all
  if (filters.priority) {
    jobs = jobs.filter(job => String(job.priority) === filters.priority)
  }
  if (filters.status === 'new') {
    jobs = jobs.filter(job => job._status === 'new')
  } else if (filters.status) {
    jobs = jobs.filter(job => job._status === filters.status)
  }
  if (filters.search) {
    const term = filters.search.toLowerCase()
    jobs = jobs.filter(job => job.title.toLowerCase().includes(term) || job.company.toLowerCase().includes(term))
  }

  const state: JobsViewState = {
    status: viewStatus,
    message,
    all,
    jobs,
    filters,
    selectedId,
  }
  page.setState(state)
}
