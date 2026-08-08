/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { QueuesPage } from './pages/queues/index.js'
import './pages/queues/index.js'
import { _resetQueuesMediatorForTesting, initQueuesMediator } from './queues-mediator.js'

const summary = {
  pending: { fetch_job_details: 1, rank: 2 },
  done: 3,
  total: 6,
  recent: [
    {
      id: 1,
      jobId: 10,
      title: 'Staff Engineer',
      companyName: 'Acme',
      providerJobId: 'job-1',
      stage: 'fetch_job_details',
      queuedAt: '2026-08-08 09:00:00',
      completedAt: null,
    },
  ],
}

function mockFetch(ok: boolean): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, json: async () => (ok ? summary : {}) }))
  )
}

describe('queues-mediator', () => {
  afterEach(() => {
    _resetQueuesMediatorForTesting()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('fetches the summary when queues-page becomes ready and pushes it in', async () => {
    mockFetch(true)
    initQueuesMediator()
    const page = document.createElement('queues-page') as QueuesPage
    document.body.appendChild(page)

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/analysis-queue/summary')
    expect(page.querySelector('.page-count')?.textContent).toBe('3 pending · 3 done')
    expect(page.querySelector('.queue-row')).not.toBeNull()
  })

  it('renders an empty state when the summary fetch fails', async () => {
    mockFetch(false)
    initQueuesMediator()
    const page = document.createElement('queues-page') as QueuesPage
    document.body.appendChild(page)

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(page.querySelector('.page-count')?.textContent).toBe('0 pending · 0 done')
    expect(page.querySelector('.queue-empty')).not.toBeNull()
  })
})
