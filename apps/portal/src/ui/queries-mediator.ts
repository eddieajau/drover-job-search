/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Query } from '../shared/types.js'
import { parseHash } from './navigation-state.js'

interface SaveQueryDetail {
  id?: number
  queryText: string
  queryOptions: {
    location?: string
    workType?: string
    jobType?: string
  }
  enabled: boolean
}

let registered = false

export function initQueriesMediator(): void {
  if (registered) {
    return
  }
  registered = true
  window.addEventListener('queries-page:ready', handleQueriesReady)
  window.addEventListener('queries-list:toggle', handleToggle)
  window.addEventListener('query-edit-page:ready', handleEditReady)
  window.addEventListener('query-edit-page:save', handleSave)

  if (document.querySelector('queries-page')) {
    void handleQueriesReady()
  }
  if (document.querySelector('query-edit-page')) {
    void handleEditReady()
  }
}

export function _resetQueriesMediatorForTesting(): void {
  if (registered) {
    window.removeEventListener('queries-page:ready', handleQueriesReady)
    window.removeEventListener('queries-list:toggle', handleToggle)
    window.removeEventListener('query-edit-page:ready', handleEditReady)
    window.removeEventListener('query-edit-page:save', handleSave)
  }
  registered = false
}

async function handleQueriesReady(): Promise<void> {
  const page = document.querySelector('queries-page')
  if (!page) {
    return
  }
  try {
    const response = await fetch('/api/queries')
    if (!response.ok) {
      throw new Error('Failed to load queries')
    }
    const queries = (await response.json()) as Query[]
    page.setQueries(queries)
  } catch {
    page.setQueries([])
  }
}

async function handleToggle(event: Event): Promise<void> {
  const { query } = (event as CustomEvent<{ query: Query }>).detail
  try {
    await fetch('/api/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: query.id,
        queryText: query.queryText,
        queryOptions: query.queryOptions,
        enabled: query.enabled,
      }),
    })
  } catch {
    // Keep the previous state visible on failure
    return
  }
  await refreshQueries()
}

async function handleEditReady(): Promise<void> {
  const page = document.querySelector('query-edit-page')
  if (!page) {
    return
  }
  const state = parseHash(window.location.hash)
  let query: Query | undefined
  if (state?.view === 'query-edit' && state.id != null) {
    try {
      const response = await fetch(`/api/queries?id=${state.id}`)
      if (response.ok) {
        query = (await response.json()) as Query
      }
    } catch {
      // Fall back to the blank new-query form
    }
  }
  page.setState({ query })
}

async function handleSave(event: Event): Promise<void> {
  const detail = (event as CustomEvent<SaveQueryDetail>).detail
  try {
    await fetch('/api/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(detail),
    })
  } catch {
    // Keep the user on the form on failure
    return
  }
  window.location.hash = '#queries'
}

async function refreshQueries(): Promise<void> {
  const page = document.querySelector('queries-page')
  if (!page) {
    return
  }
  try {
    const response = await fetch('/api/queries')
    if (!response.ok) {
      throw new Error('Failed to load queries')
    }
    page.setQueries((await response.json()) as Query[])
  } catch {
    // Leave the list unchanged on failure
  }
}
