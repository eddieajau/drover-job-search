/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { _resetDashboardMediatorForTesting, initDashboardMediator } from './dashboard-mediator.js'
import './pages/dashboard/index.js'
import type { DashboardPage } from './pages/dashboard/index.js'

const chart = {
  days: [
    { day: '2026-08-06', count: 0 },
    { day: '2026-08-07', count: 0 },
    { day: '2026-08-08', count: 2 },
    { day: '2026-08-09', count: 0 },
    { day: '2026-08-10', count: 1 },
    { day: '2026-08-11', count: 0 },
    { day: '2026-08-12', count: 0 },
    { day: '2026-08-13', count: 0 },
    { day: '2026-08-14', count: 0 },
    { day: '2026-08-15', count: 3 },
    { day: '2026-08-16', count: 0 },
    { day: '2026-08-17', count: 0 },
    { day: '2026-08-18', count: 0 },
    { day: '2026-08-19', count: 0 },
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

describe('dashboard-mediator', () => {
  afterEach(() => {
    _resetDashboardMediatorForTesting()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('fetches the chart when dashboard-page becomes ready and pushes it in', async () => {
    mockFetch({ '/api/applications/chart': chart })
    initDashboardMediator()
    const page = document.createElement('dashboard-page') as DashboardPage
    document.body.appendChild(page)

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/applications/chart')
    expect(page.querySelectorAll('.chart svg rect').length).toBe(14)
  })

  it('renders an empty chart when the fetch fails', async () => {
    mockFetch({})
    initDashboardMediator()
    const page = document.createElement('dashboard-page') as DashboardPage
    document.body.appendChild(page)

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(page.querySelectorAll('.chart svg rect').length).toBe(14)
    expect(page.querySelector('applications-chart')?.hasAttribute('data-empty')).toBe(true)
  })
})
