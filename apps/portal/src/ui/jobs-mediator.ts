/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Job, JobStatus } from '../shared/types.js'
import type { JobsFilters, JobsViewState, JobWithStatus } from './jobs-view.js'
import { parseHash } from './navigation-state.js'

type ViewStatus = 'idle' | 'loading' | 'error' | 'done'
type SeenMap = Record<number, Omit<JobStatus, 'id'>>

interface JobsResponse {
  count: number
  limit: number
  offset: number
  results: Job[]
}

const HOT_THRESHOLD = 50

const DIMENSION_WEIGHTS: Record<string, number> = {
  technical: 0.3,
  experience: 0.25,
  behavioral: 0.15,
  career: 0.3,
}

function computeNetScore(job: Job): number | undefined {
  if (!job.signals) {
    return undefined
  }
  let weighted = 0
  for (const [dimension, score] of Object.entries(job.signals.dimensions)) {
    weighted += score * (DIMENSION_WEIGHTS[dimension] ?? 0)
  }
  return Math.round(weighted) + job.signals.baseScore
}

let registered = false

let results: Job[] = []
let seen: SeenMap = {}
let selectedId: number | null = null
let filters: JobsFilters = { priority: '', status: '', search: '', score: '' }
let viewStatus: ViewStatus = 'idle'
let message = ''
let page = 1
let pageSize = 50
let total = 0

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
  window.addEventListener('pager:change', handlePagerChange)
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
    window.removeEventListener('pager:change', handlePagerChange)
  }
  registered = false
  results = []
  seen = {}
  selectedId = null
  filters = { priority: '', status: '', search: '', score: '' }
  viewStatus = 'idle'
  message = ''
  page = 1
  pageSize = 50
  total = 0
}

function handleReady(): void {
  void handleSearch()
}

async function handleSearch(): Promise<void> {
  const jobsPage = document.querySelector('jobs-page')
  if (!jobsPage) {
    return
  }
  if (selectedId === null) {
    seedSelectedIdFromHash()
  }
  viewStatus = 'loading'
  jobsPage.setLoading()
  try {
    const params = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) })
    const response = await fetch(`/api/jobs?${params.toString()}`)
    if (!response.ok) {
      throw new Error('Failed to load jobs')
    }
    const data = (await response.json()) as JobsResponse
    results = data.results
    total = data.count
    viewStatus = 'done'
    message = ''
    pushState()
  } catch {
    viewStatus = 'error'
    message = 'Failed to load. Is the server running?'
    pushState()
  }
}

function handlePagerChange(event: Event): void {
  const { page: nextPage, pageSize: nextPageSize } = (event as CustomEvent<{ page: number; pageSize: number }>).detail
  page = nextPage
  pageSize = nextPageSize
  void handleSearch()
}

function handleSelect(event: Event): void {
  const { jobId } = (event as CustomEvent<{ jobId: number }>).detail
  selectedId = jobId
  syncHash()
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

function seedSelectedIdFromHash(): void {
  const state = parseHash(window.location.hash)
  if (state?.view === 'jobs' && state.job != null) {
    selectedId = state.job
  }
}

function syncHash(): void {
  const target = selectedId != null ? `#jobs?job=${selectedId}` : '#jobs'
  if (window.location.hash !== target) {
    history.replaceState(null, '', target)
  }
}

function pushState(): void {
  const jobsPage = document.querySelector('jobs-page')
  if (!jobsPage) {
    return
  }
  const all: JobWithStatus[] = results.map(job => ({
    ...job,
    _status: seen[job.id]?.status ?? 'new',
    netScore: computeNetScore(job),
    gated: job.signals?.gated,
  }))

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
    page,
    pageSize,
    total,
  }
  jobsPage.setState(state)
}
