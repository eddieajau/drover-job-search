/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Job, JobStatus } from '../shared/types.js'
import type { JobsFilters, JobsViewState, JobWithStatus } from './jobs-view.js'

type ViewStatus = 'idle' | 'loading' | 'error' | 'done'
type SeenMap = Record<number, Omit<JobStatus, 'id'>>

interface JobsResponse {
  count: number
  results: Job[]
}

interface SignalSummary {
  netScore: number
  signalCount: number
  gated: boolean
}

const HOT_THRESHOLD = 50

let registered = false

let results: Job[] = []
let seen: SeenMap = {}
let selectedId: number | null = null
let filters: JobsFilters = { priority: '', status: '', search: '', score: '' }
let viewStatus: ViewStatus = 'idle'
let message = ''
let signalSummaries: Record<string, SignalSummary> = {}

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
  if (document.querySelector('jobs-page')) {
    void handleSearch()
  }
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
  filters = { priority: '', status: '', search: '', score: '' }
  viewStatus = 'idle'
  message = ''
  signalSummaries = {}
}

function handleReady(): void {
  void handleSearch()
}

async function handleSearch(): Promise<void> {
  const page = document.querySelector('jobs-page')
  if (!page) {
    return
  }
  viewStatus = 'loading'
  page.setLoading()
  try {
    const response = await fetch('/api/jobs')
    if (!response.ok) {
      throw new Error('Failed to load jobs')
    }
    const data = (await response.json()) as JobsResponse
    results = mergeResults(results, data.results)
    await fetchSignalSummaries()
    viewStatus = 'done'
    message = ''
    pushState()
  } catch {
    viewStatus = 'error'
    message = 'Failed to load. Is the server running?'
    pushState()
  }
}

async function fetchSignalSummaries(): Promise<void> {
  if (results.length === 0) {
    return
  }
  const ids = results.map(j => j.providerJobId).join(',')
  try {
    const response = await fetch(`/api/signals/summary?provider=linkedin&ids=${encodeURIComponent(ids)}`)
    if (response.ok) {
      signalSummaries = (await response.json()) as Record<string, SignalSummary>
    }
  } catch {
    // silently fail — signals are optional enrichment
  }
}

function mergeResults(existing: Job[], incoming: Job[]): Job[] {
  const byId = new Map<number, Job>(existing.map(job => [job.id, job]))
  for (const job of incoming) {
    byId.set(job.id, job)
  }
  return Array.from(byId.values())
}

function handleSelect(event: Event): void {
  const { jobId } = (event as CustomEvent<{ jobId: number }>).detail
  selectedId = jobId
  pushState()
}

function handleStatus(event: Event): void {
  const detail = (event as CustomEvent<{ jobId: number; status: JobStatus['status'] }>).detail
  track(detail.jobId, detail.status)
}

function handleFilterChange(event: Event): void {
  filters = (event as CustomEvent<JobsFilters>).detail
  pushState()
}

function track(id: number, status: JobStatus['status']): void {
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
  const all: JobWithStatus[] = results.map(job => {
    const summary = signalSummaries[job.providerJobId]
    return {
      ...job,
      _status: seen[job.id]?.status ?? 'new',
      netScore: summary?.netScore,
      gated: summary?.gated,
    }
  })

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
    jobs = jobs.filter(job => job.title.toLowerCase().includes(term) || job.companyName.toLowerCase().includes(term))
  }
  if (filters.score === 'hot') {
    jobs = jobs.filter(job => !job.gated && (job.netScore ?? 0) >= HOT_THRESHOLD)
  } else if (filters.score === 'neutral') {
    jobs = jobs.filter(job => !job.gated && (job.netScore ?? 0) < HOT_THRESHOLD)
  } else if (filters.score === 'auto-skip') {
    jobs = jobs.filter(job => job.gated)
  } else {
    jobs = jobs.filter(job => !job.gated)
  }

  jobs.sort((a, b) => (b.netScore ?? 0) - (a.netScore ?? 0))

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
