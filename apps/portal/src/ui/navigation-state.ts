/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { JobsFilters, JobSortKey } from './jobs-view.js'

export type NavigationState =
  | { view: 'jobs'; job?: number; filters?: JobsFilters }
  | { view: 'queries' }
  | { view: 'query-edit'; id?: number }
  | { view: 'signals' }
  | { view: 'queues' }
  | { view: 'facts' }
  | { view: 'fact-edit'; id?: number }
  | { view: 'fact-ingest' }

export function parseHash(hash: string): NavigationState | null {
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  if (h === 'queries') {
    return { view: 'queries' }
  }
  if (h === 'facts') {
    return { view: 'facts' }
  }
  if (h === 'facts/ingest') {
    return { view: 'fact-ingest' }
  }
  if (h === 'signals') {
    return { view: 'signals' }
  }
  if (h === 'queues') {
    return { view: 'queues' }
  }
  const [path, queryString] = h.split('?')
  if (path === 'jobs' || path === '') {
    const params = new URLSearchParams(queryString ?? '')
    const state: NavigationState = { view: 'jobs' }
    const jobRaw = params.get('job')
    if (jobRaw != null) {
      const job = Number(jobRaw)
      if (Number.isInteger(job) && job > 0) {
        state.job = job
      }
    }
    const filters = readFilters(params)
    if (filters) {
      state.filters = filters
    }
    return state
  }
  if (path === 'queries/edit') {
    const params = new URLSearchParams(queryString ?? '')
    const idRaw = params.get('id')
    if (idRaw == null) {
      return { view: 'query-edit' }
    }
    const id = Number(idRaw)
    if (Number.isInteger(id) && id > 0) {
      return { view: 'query-edit', id }
    }
  }
  if (path === 'facts/edit') {
    const params = new URLSearchParams(queryString ?? '')
    const idRaw = params.get('id')
    if (idRaw == null) {
      return { view: 'fact-edit' }
    }
    const id = Number(idRaw)
    if (Number.isInteger(id) && id > 0) {
      return { view: 'fact-edit', id }
    }
  }
  return null
}

function readFilters(params: URLSearchParams): JobsFilters | undefined {
  const priority = params.get('priority') ?? ''
  const status = params.get('status') ?? ''
  const search = params.get('q') ?? ''
  const score = params.get('score') ?? ''
  const sort = (params.get('sort') ?? '') as JobSortKey | ''
  if (!priority && !status && !search && !score && !sort) {
    return undefined
  }
  return { priority, status, search, score, sort: sort || 'score' }
}

export function toHash(state: NavigationState): string {
  switch (state.view) {
    case 'jobs': {
      const params = new URLSearchParams()
      if (state.job != null) {
        params.set('job', String(state.job))
      }
      const filters = state.filters
      if (filters) {
        if (filters.priority) {
          params.set('priority', filters.priority)
        }
        if (filters.status && filters.status !== 'relevant') {
          params.set('status', filters.status)
        }
        if (filters.score && filters.score !== 'relevant') {
          params.set('score', filters.score)
        }
        if (filters.search) {
          params.set('q', filters.search)
        }
        if (filters.sort && filters.sort !== 'score') {
          params.set('sort', filters.sort)
        }
      }
      const query = params.toString()
      return query ? `#jobs?${query}` : '#jobs'
    }
    case 'queries':
      return '#queries'
    case 'signals':
      return '#signals'
    case 'queues':
      return '#queues'
    case 'facts':
      return '#facts'
    case 'query-edit': {
      if (state.id == null) {
        return '#queries/edit'
      }
      return `#queries/edit?id=${state.id}`
    }
    case 'fact-edit': {
      if (state.id == null) {
        return '#facts/edit'
      }
      return `#facts/edit?id=${state.id}`
    }
    case 'fact-ingest':
      return '#facts/ingest'
  }
}
