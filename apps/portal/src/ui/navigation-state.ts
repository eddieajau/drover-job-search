/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export type NavigationState =
  | { view: 'jobs'; job?: number }
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
    const jobRaw = params.get('job')
    if (jobRaw != null) {
      const job = Number(jobRaw)
      if (Number.isInteger(job) && job > 0) {
        return { view: 'jobs', job }
      }
    }
    return { view: 'jobs' }
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

export function toHash(state: NavigationState): string {
  switch (state.view) {
    case 'jobs':
      if (state.job != null) {
        return `#jobs?job=${state.job}`
      }
      return '#jobs'
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
