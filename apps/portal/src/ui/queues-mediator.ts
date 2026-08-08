/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { QueueSummaryResponse } from '../shared/types.js'

let registered = false

export function initQueuesMediator(): void {
  if (registered) {
    return
  }
  registered = true
  window.addEventListener('queues-page:ready', handleQueuesReady)
}

export function _resetQueuesMediatorForTesting(): void {
  if (registered) {
    window.removeEventListener('queues-page:ready', handleQueuesReady)
  }
  registered = false
}

async function handleQueuesReady(): Promise<void> {
  const page = document.querySelector('queues-page')
  if (!page) {
    return
  }
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
