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

function mockFetch(routes: Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      for (const [pattern, data] of Object.entries(routes)) {
        if (url.includes(pattern)) {
          return { ok: true, json: async () => data }
        }
      }
      return { ok: false, status: 404 }
    })
  )
}

describe('queues-mediator', () => {
  afterEach(() => {
    _resetQueuesMediatorForTesting()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('fetches the summary when queues-page becomes ready and pushes it in', async () => {
    mockFetch({ '/api/analysis-queue/summary': summary })
    initQueuesMediator()
    const page = document.createElement('queues-page') as QueuesPage
    document.body.appendChild(page)

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/analysis-queue/summary')
    expect(page.querySelector('.page-count')?.textContent).toBe('3 pending · 3 done')
    expect(page.querySelector('.queue-row')).not.toBeNull()
  })

  it('renders an empty state when the summary fetch fails', async () => {
    mockFetch({})
    initQueuesMediator()
    const page = document.createElement('queues-page') as QueuesPage
    document.body.appendChild(page)

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(page.querySelector('.page-count')?.textContent).toBe('0 pending · 0 done')
    expect(page.querySelector('.queue-empty')).not.toBeNull()
  })

  it('POSTs /api/bus with flagged on queues-page:kick then refreshes the summary', async () => {
    mockFetch({ '/api/analysis-queue/summary': summary, '/api/bus': { ok: true } })
    initQueuesMediator()
    const page = document.createElement('queues-page') as QueuesPage
    document.body.appendChild(page)
    await new Promise(resolve => setTimeout(resolve, 0))

    window.dispatchEvent(new CustomEvent('queues-page:kick', { detail: { event: 'flagged' } }))
    await new Promise(resolve => setTimeout(resolve, 0))

    const calls = vi.mocked(fetch).mock.calls
    const busCall = calls.find(([url, init]) => url === '/api/bus' && init?.method === 'POST')
    expect(busCall).toBeDefined()
    expect(JSON.parse(String(busCall?.[1]?.body))).toEqual({ event: 'flagged' })

    const summaryCalls = calls.filter(([url]) => url === '/api/analysis-queue/summary')
    expect(summaryCalls.length).toBe(2)
  })

  it('POSTs /api/bus with descriptions-ready on queues-page:kick for rank', async () => {
    mockFetch({ '/api/analysis-queue/summary': summary, '/api/bus': { ok: true } })
    initQueuesMediator()
    const page = document.createElement('queues-page') as QueuesPage
    document.body.appendChild(page)
    await new Promise(resolve => setTimeout(resolve, 0))

    window.dispatchEvent(new CustomEvent('queues-page:kick', { detail: { event: 'descriptions-ready' } }))
    await new Promise(resolve => setTimeout(resolve, 0))

    const calls = vi.mocked(fetch).mock.calls
    const busCall = calls.find(([url, init]) => url === '/api/bus' && init?.method === 'POST')
    expect(busCall).toBeDefined()
    expect(JSON.parse(String(busCall?.[1]?.body))).toEqual({ event: 'descriptions-ready' })
  })

  it('sets the button busy during the POST and re-enables after', async () => {
    let resolvePost: (() => void) | undefined
    const postPromise = new Promise<void>(resolve => {
      resolvePost = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/bus')) {
          await postPromise
          return { ok: true, json: async () => ({ ok: true }) }
        }
        return { ok: true, json: async () => summary }
      })
    )

    initQueuesMediator()
    const page = document.createElement('queues-page') as QueuesPage
    document.body.appendChild(page)
    await new Promise(resolve => setTimeout(resolve, 0))

    window.dispatchEvent(new CustomEvent('queues-page:kick', { detail: { event: 'flagged' } }))
    await new Promise(resolve => setTimeout(resolve, 0))

    const btn = page.querySelector<HTMLButtonElement>('[data-action="kick-details"]')
    expect(btn?.disabled).toBe(true)
    expect(btn?.getAttribute('aria-busy')).toBe('true')

    resolvePost!()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(btn?.disabled).toBe(false)
    expect(btn?.getAttribute('aria-busy')).toBe('false')
  })

  it('refreshes the summary on queues-page:tick', async () => {
    mockFetch({ '/api/analysis-queue/summary': summary })
    initQueuesMediator()
    const page = document.createElement('queues-page') as QueuesPage
    document.body.appendChild(page)
    await new Promise(resolve => setTimeout(resolve, 0))

    const callsBefore = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/analysis-queue/summary').length

    window.dispatchEvent(new CustomEvent('queues-page:tick'))
    await new Promise(resolve => setTimeout(resolve, 0))

    const callsAfter = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/analysis-queue/summary').length
    expect(callsAfter).toBe(callsBefore + 1)
  })
})
