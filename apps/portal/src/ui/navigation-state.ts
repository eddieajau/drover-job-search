/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { JobsFilters } from './jobs-view.js'

export type NavigationState =
  | { view: 'jobs'; job?: number; filters?: JobsFilters }
  | { view: 'queries' }
  | { view: 'query-edit'; id?: number }
  | { view: 'signals' }

export function parseHash(hash: string): NavigationState | null {
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  if (h === 'queries') {
    return { view: 'queries' }
  }
  if (h === 'signals') {
    return { view: 'signals' }
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
  return null
}

function readFilters(params: URLSearchParams): JobsFilters | undefined {
  const priority = params.get('priority') ?? ''
  const status = params.get('status') ?? ''
  const search = params.get('q') ?? ''
  const score = params.get('score') ?? ''
  if (!priority && !status && !search && !score) {
    return undefined
  }
  return { priority, status, search, score }
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
        if (filters.status) {
          params.set('status', filters.status)
        }
        if (filters.score) {
          params.set('score', filters.score)
        }
        if (filters.search) {
          params.set('q', filters.search)
        }
      }
      const query = params.toString()
      return query ? `#jobs?${query}` : '#jobs'
    }
    case 'queries':
      return '#queries'
    case 'signals':
      return '#signals'
    case 'query-edit': {
      if (state.id == null) {
        return '#queries/edit'
      }
      return `#queries/edit?id=${state.id}`
    }
  }
}
