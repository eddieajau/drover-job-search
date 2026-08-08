/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { QueueSummaryResponse } from '../shared/types.js'
import type { QueuesPage } from './pages/queues/index.js'

let registered = false

export function initQueuesMediator(): void {
  if (registered) {
    return
  }
  registered = true
  window.addEventListener('queues-page:ready', handleReady)
  window.addEventListener('queues-page:kick', handleKick)
  window.addEventListener('queues-page:tick', handleTick)
}

export function _resetQueuesMediatorForTesting(): void {
  if (registered) {
    window.removeEventListener('queues-page:ready', handleReady)
    window.removeEventListener('queues-page:kick', handleKick)
    window.removeEventListener('queues-page:tick', handleTick)
  }
  registered = false
}

async function handleReady(): Promise<void> {
  const page = document.querySelector<QueuesPage>('queues-page')
  if (!page) return
  await refreshSummary(page)
}

async function handleKick(event: Event): Promise<void> {
  const { event: busEvent } = (event as CustomEvent<{ event: 'flagged' | 'descriptions-ready' }>).detail
  const page = document.querySelector<QueuesPage>('queues-page')
  if (!page) return
  page.setKickBusy(busEvent, true)
  try {
    await fetch('/api/bus', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: busEvent }),
    })
  } catch {
    // Keep the UI visible on failure
  }
  page.setKickBusy(busEvent, false)
  await refreshSummary(page)
}

async function handleTick(): Promise<void> {
  const page = document.querySelector<QueuesPage>('queues-page')
  if (!page) return
  await refreshSummary(page)
}

async function refreshSummary(page: QueuesPage): Promise<void> {
  try {
    const response = await fetch('/api/analysis-queue/summary')
    if (!response.ok) {
      throw new Error('Failed to load queue summary')
    }
    page.setSummary((await response.json()) as QueueSummaryResponse)
  } catch {
    page.setSummary({ pending: { fetch_job_details: 0, rank: 0 }, done: 0, total: 0, recent: [] })
  }
}
