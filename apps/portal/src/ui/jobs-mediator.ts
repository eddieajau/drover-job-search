/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Job, JobNote, JobStatus } from '../shared/types.js'
import type { JobsFilters, JobsViewState, JobWithStatus, JobSortKey } from './jobs-view.js'
import type { NavigationState } from './navigation-state.js'
import { parseHash, toHash } from './navigation-state.js'

type ViewStatus = 'idle' | 'loading' | 'error' | 'done'

interface JobsResponse {
  count: number
  limit: number
  offset: number
  results: Job[]
}

function postedAtMs(postedAt: string | null): number {
  if (!postedAt) {
    return 0
  }
  const time = new Date(postedAt).getTime()
  return Number.isNaN(time) ? 0 : time
}

let registered = false

let results: Job[] = []
let selectedId: number | null = null
let filters: JobsFilters = { status: 'new', search: '', sort: 'score' }
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
  seedFiltersFromHash()
  window.addEventListener('jobs-page:ready', handleReady)
  window.addEventListener('job-list:select', handleSelect)
  window.addEventListener('job-list:status', handleStatus)
  window.addEventListener('job-meta:status', handleStatus)
  window.addEventListener('job-note:save', handleNoteSave)
  window.addEventListener('job-meta:open', handleOpen)
  window.addEventListener('filter-bar:change', handleFilterChange)
  window.addEventListener('pager:change', handlePagerChange)
  window.addEventListener('jobs:refresh-request', handleRefreshRequest)
  if (document.querySelector('jobs-page')) {
    void handleSearch()
  }
}

export function _resetJobsMediatorForTesting(): void {
  if (registered) {
    window.removeEventListener('jobs-page:ready', handleReady)
    window.removeEventListener('job-list:select', handleSelect)
    window.removeEventListener('job-list:status', handleStatus)
    window.removeEventListener('job-meta:status', handleStatus)
    window.removeEventListener('job-note:save', handleNoteSave)
    window.removeEventListener('job-meta:open', handleOpen)
    window.removeEventListener('filter-bar:change', handleFilterChange)
    window.removeEventListener('pager:change', handlePagerChange)
    window.removeEventListener('jobs:refresh-request', handleRefreshRequest)
  }
  registered = false
  results = []
  selectedId = null
  filters = { status: 'new', search: '', sort: 'score' }
  viewStatus = 'idle'
  message = ''
  page = 1
  pageSize = 50
  total = 0
}

function handleReady(): void {
  void handleSearch()
}

function handleRefreshRequest(): void {
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
    if (filters.search) {
      params.set('q', filters.search)
    }
    params.set('status', filters.status)
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
  void persistStatus(detail.jobId, detail.status)
}

async function persistStatus(id: number, status: JobStatus['status']): Promise<void> {
  try {
    const response = await fetch(`/api/jobs/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) {
      throw new Error('Failed to update job status')
    }
  } catch {
    viewStatus = 'error'
    message = 'Failed to save job status'
  }
  if (status === 'skipped') {
    results = results.filter(job => job.id !== id)
    pushState()
  }
  void handleSearch()
}

function handleNoteSave(event: Event): void {
  const detail = (event as CustomEvent<{ jobId: number; kind: JobNote['kind']; date?: string; note: string }>).detail
  void persistNote(detail)
}

async function persistNote(detail: {
  jobId: number
  kind: JobNote['kind']
  date?: string
  note: string
}): Promise<void> {
  try {
    const isGeneral = detail.kind === 'general'
    const response = await fetch(isGeneral ? `/api/jobs/${detail.jobId}/notes` : `/api/jobs/${detail.jobId}/status`, {
      method: isGeneral ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isGeneral ? { kind: 'general', note: detail.note } : { status: detail.kind, at: detail.date, note: detail.note }
      ),
    })
    if (!response.ok) {
      throw new Error('Failed to save job note')
    }
  } catch {
    viewStatus = 'error'
    message = 'Failed to save job note'
  }
  void handleSearch()
}

async function loadNotes(id: number): Promise<void> {
  try {
    const response = await fetch(`/api/jobs/${id}/notes`)
    if (!response.ok) {
      return
    }
    const notes = (await response.json()) as unknown
    if (!Array.isArray(notes)) {
      return
    }
    document.querySelector('job-meta-panel')?.setNotes(notes as JobNote[])
  } catch {
    // Leave the notes section as-is on failure
  }
}

function handleOpen(event: Event): void {
  const { url } = (event as CustomEvent<{ url: string }>).detail
  window.open(url, '_blank')
}

function handleFilterChange(event: Event): void {
  filters = (event as CustomEvent<JobsFilters>).detail
  syncHash()
  void handleSearch()
}

function seedSelectedIdFromHash(): void {
  const state = parseHash(window.location.hash)
  if (state?.view === 'jobs' && state.job != null) {
    selectedId = state.job
  }
}

function seedFiltersFromHash(): void {
  const state = parseHash(window.location.hash)
  if (state?.view === 'jobs' && state.filters) {
    filters = { ...filters, ...state.filters }
    if (!filters.status) {
      filters.status = 'new'
    }
  }
}

function syncHash(): void {
  const state: NavigationState = { view: 'jobs' }
  if (selectedId != null) {
    state.job = selectedId
  }
  state.filters = filters
  const target = toHash(state)
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
    _status: (job.status as JobStatus['status']) ?? 'new',
    netScore: job.signals?.netScore,
    gated: job.signals?.gated,
  }))

  const jobs = all

  jobs.sort((a, b) => {
    const sortKey: JobSortKey = filters.sort ?? 'score'
    if (sortKey === 'posted') {
      const byPosted = postedAtMs(b.postedAt) - postedAtMs(a.postedAt)
      if (byPosted !== 0) {
        return byPosted
      }
      return b.id - a.id
    }
    if (sortKey === 'company') {
      const byCompany = (a.companyName ?? '').localeCompare(b.companyName ?? '', undefined, { sensitivity: 'base' })
      if (byCompany !== 0) {
        return byCompany
      }
      return (b.netScore ?? 0) - (a.netScore ?? 0)
    }
    const byScore = (b.netScore ?? 0) - (a.netScore ?? 0)
    if (byScore !== 0) {
      return byScore
    }
    return postedAtMs(b.postedAt) - postedAtMs(a.postedAt)
  })

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

  if (selectedId !== null) {
    void loadNotes(selectedId)
  }
}
