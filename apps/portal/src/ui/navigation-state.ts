/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export type NavigationState = { view: 'jobs' } | { view: 'queries' } | { view: 'query-edit'; id?: number }

export function parseHash(hash: string): NavigationState | null {
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  if (h === 'queries') {
    return { view: 'queries' }
  }
  if (h === 'jobs' || h === '') {
    return { view: 'jobs' }
  }
  const [path, queryString] = h.split('?')
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
      return '#jobs'
    case 'queries':
      return '#queries'
    case 'query-edit': {
      if (state.id == null) {
        return '#queries/edit'
      }
      return `#queries/edit?id=${state.id}`
    }
  }
}
