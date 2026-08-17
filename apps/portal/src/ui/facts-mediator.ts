/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { FactResponse, TaskStatus } from '../shared/types.js'
import { parseHash } from './navigation-state.js'
import type { FactIngestPage } from './pages/facts/fact-ingest-page.js'

interface SaveFactDetail {
  id?: number
  label: string
  category: string
  detail: string
  evidenceType: string
  confidence: string
  startedAt: string
  endedAt: string
  period: string
  active: boolean
}

let registered = false

export function initFactsMediator(): void {
  if (registered) {
    return
  }
  registered = true
  window.addEventListener('facts-page:ready', handleFactsReady)
  window.addEventListener('facts-page:filter', handleFilter)
  window.addEventListener('fact-edit-page:ready', handleEditReady)
  window.addEventListener('fact-edit-page:save', handleSave)
  window.addEventListener('fact-ingest-page:ingest', handleIngest)

  if (document.querySelector('facts-page')) {
    void handleFactsReady()
  }
  if (document.querySelector('fact-edit-page')) {
    void handleEditReady()
  }
}

export function _resetFactsMediatorForTesting(): void {
  if (registered) {
    window.removeEventListener('facts-page:ready', handleFactsReady)
    window.removeEventListener('facts-page:filter', handleFilter)
    window.removeEventListener('fact-edit-page:ready', handleEditReady)
    window.removeEventListener('fact-edit-page:save', handleSave)
    window.removeEventListener('fact-ingest-page:ingest', handleIngest)
  }
  registered = false
}

async function handleFactsReady(): Promise<void> {
  await refreshFacts()
}

async function handleFilter(event: Event): Promise<void> {
  const { category, active } = (event as CustomEvent<{ category: string; active: string }>).detail
  await refreshFacts(category, active)
}

async function handleEditReady(): Promise<void> {
  const page = document.querySelector('fact-edit-page')
  if (!page) {
    return
  }
  const state = parseHash(window.location.hash)
  let fact: FactResponse | undefined
  if (state?.view === 'fact-edit' && state.id != null) {
    try {
      const response = await fetch(`/api/facts?id=${state.id}`)
      if (response.ok) {
        const data = (await response.json()) as FactResponse | FactResponse[]
        fact = Array.isArray(data) ? data[0] : data
      }
    } catch {
      // Fall back to the blank new-fact form
    }
  }
  page.setState({ fact })
}

async function handleSave(event: Event): Promise<void> {
  const detail = (event as CustomEvent<SaveFactDetail>).detail
  try {
    if (detail.id == null) {
      const response = await fetch('/api/facts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(detail),
      })
      if (!response.ok) {
        return
      }
    } else {
      const { id: _id, ...factBody } = detail
      const response = await fetch(`/api/facts/${detail.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(factBody),
      })
      if (!response.ok) {
        return
      }
    }
  } catch {
    return
  }
  window.location.hash = '#facts'
}

const POLL_INTERVAL = 2000

let ingestAbort: AbortController | null = null

async function handleIngest(event: Event): Promise<void> {
  const page = document.querySelector('fact-ingest-page')
  if (!page) {
    return
  }
  const { resume } = (event as CustomEvent<{ resume: string }>).detail
  ingestAbort?.abort()
  const abort = new AbortController()
  ingestAbort = abort
  page.setBusy(true)
  try {
    const response = await fetch('/api/facts/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resume }),
      signal: abort.signal,
    })
    if (response.status === 202) {
      const data = (await response.json()) as { taskId: number }
      await pollTask(page, data.taskId, abort.signal)
    } else {
      page.setResult({ error: 'ingestion failed' })
    }
  } catch {
    if (!abort.signal.aborted) {
      page.setResult({ error: 'ingestion failed' })
    }
  } finally {
    page.setBusy(false)
    if (ingestAbort === abort) {
      ingestAbort = null
    }
  }
}

async function pollTask(page: FactIngestPage, taskId: number, signal: AbortSignal): Promise<void> {
  for (;;) {
    if (signal.aborted || !page.isConnected) {
      return
    }
    let task: TaskStatus
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { signal })
      if (!response.ok) {
        page.setResult({ error: 'ingestion failed' })
        return
      }
      task = (await response.json()) as TaskStatus
    } catch {
      if (!signal.aborted) {
        page.setResult({ error: 'ingestion failed' })
      }
      return
    }
    if (task.completedAt !== null) {
      if (task.errorMessage) {
        page.setResult({ error: task.errorMessage })
      } else {
        page.setResult({ inserted: task.result?.inserted ?? 0, superseded: task.result?.superseded })
      }
      return
    }
    await waitForNextPoll(signal)
  }
}

function waitForNextPoll(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onAbort = (): void => {
      if (timer !== undefined) {
        clearTimeout(timer)
      }
      resolve()
    }
    timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, POLL_INTERVAL)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function refreshFacts(category?: string, active?: string): Promise<void> {
  const page = document.querySelector('facts-page')
  if (!page) {
    return
  }
  try {
    const params = new URLSearchParams()
    if (category) {
      params.set('category', category)
    }
    if (active) {
      params.set('active', active)
    }
    const query = params.toString()
    const url = query ? `/api/facts?${query}` : '/api/facts'
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to load facts')
    }
    const facts = (await response.json()) as FactResponse[]
    page.setFacts(facts)
  } catch {
    page.setFacts([])
  }
}
