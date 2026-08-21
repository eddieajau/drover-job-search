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

const summary = {
  applied: { count: 14, delta: 2 },
  inFlight: { applied: 12, interviewing: 4 },
  interviewRate: 15,
  pipeline: { applied: 12, interviewing: 4, successful: 1, unsuccessful: 3, declined: 2 },
  attention: [],
}

const queueHealth = { pending: { fetch_job_details: 1, rank: 2 }, done: 3, total: 6 }

function mockFetch(routes: Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      for (const [pattern, data] of Object.entries(routes)) {
        if (url.includes(pattern)) {
          if (data === 'fail') {
            return { ok: false, status: 500 }
          }
          return { ok: true, json: async () => data }
        }
      }
      return { ok: false, status: 404 }
    })
  )
}

async function flush(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

function fetchedUrls(): string[] {
  return vi.mocked(fetch).mock.calls.map(([url]) => String(url))
}

describe('dashboard-mediator', () => {
  afterEach(() => {
    _resetDashboardMediatorForTesting()
    vi.restoreAllMocks()
    sessionStorage.clear()
    document.body.innerHTML = ''
  })

  it('fetches chart, summary, and queue health on dashboard-page:ready', async () => {
    mockFetch({
      '/api/applications/chart': chart,
      '/api/dashboard/summary': summary,
      '/api/analysis-queue/summary': queueHealth,
    })
    initDashboardMediator()
    const page = document.createElement('dashboard-page') as DashboardPage
    document.body.appendChild(page)

    await flush()

    const urls = fetchedUrls()
    expect(urls).toContain('/api/applications/chart?days=14')
    expect(urls).toContain('/api/dashboard/summary?days=14')
    expect(urls).toContain('/api/analysis-queue/summary')

    expect(page.querySelectorAll('.chart svg rect.bar').length).toBe(14)
    expect(page.querySelector('#stat-applied .stat-value')?.textContent).toBe('14')
    expect(page.querySelector('#queue-health .health-chip')?.textContent).toBe('Busy')
  })

  it('catches up when the page already exists before init', async () => {
    const page = document.createElement('dashboard-page') as DashboardPage
    document.body.appendChild(page)

    mockFetch({
      '/api/applications/chart': chart,
      '/api/dashboard/summary': summary,
      '/api/analysis-queue/summary': queueHealth,
    })
    initDashboardMediator()

    await flush()

    expect(fetchedUrls()).toContain('/api/applications/chart?days=14')
    expect(page.querySelectorAll('.chart svg rect.bar').length).toBe(14)
  })

  it('uses the current range selection for the initial fetches', async () => {
    sessionStorage.setItem('dashboard-days', '30')
    mockFetch({
      '/api/applications/chart': chart,
      '/api/dashboard/summary': summary,
      '/api/analysis-queue/summary': queueHealth,
    })
    initDashboardMediator()
    document.body.appendChild(document.createElement('dashboard-page'))

    await flush()

    const urls = fetchedUrls()
    expect(urls).toContain('/api/applications/chart?days=30')
    expect(urls).toContain('/api/dashboard/summary?days=30')
  })

  it('re-fetches chart and summary on dashboard-range:change but not queue health', async () => {
    mockFetch({
      '/api/applications/chart': chart,
      '/api/dashboard/summary': summary,
      '/api/analysis-queue/summary': queueHealth,
    })
    initDashboardMediator()
    const page = document.createElement('dashboard-page') as DashboardPage
    document.body.appendChild(page)
    await flush()

    vi.mocked(fetch).mockClear()
    const sel = page.querySelector<HTMLSelectElement>('.page-range')!
    sel.value = '7'
    sel.dispatchEvent(new Event('change'))
    await flush()

    const urls = fetchedUrls()
    expect(urls).toContain('/api/applications/chart?days=7')
    expect(urls).toContain('/api/dashboard/summary?days=7')
    expect(urls.filter(url => url.includes('/api/analysis-queue/summary'))).toHaveLength(0)
  })

  it('pushes empty chart data when only the chart fetch fails', async () => {
    mockFetch({
      '/api/applications/chart': 'fail',
      '/api/dashboard/summary': summary,
      '/api/analysis-queue/summary': queueHealth,
    })
    initDashboardMediator()
    const page = document.createElement('dashboard-page') as DashboardPage
    document.body.appendChild(page)

    await flush()

    expect(page.querySelector('applications-chart')?.hasAttribute('data-empty')).toBe(true)
    expect(page.querySelector('#stat-applied .stat-value')?.textContent).toBe('14')
    expect(page.querySelector('#queue-health .health-chip')?.textContent).toBe('Busy')
  })

  it('renders placeholder widgets without crashing when every fetch fails', async () => {
    mockFetch({})
    initDashboardMediator()
    const page = document.createElement('dashboard-page') as DashboardPage
    document.body.appendChild(page)

    await flush()

    expect(page.querySelector('applications-chart')?.hasAttribute('data-empty')).toBe(true)
    expect(page.querySelector('#stat-applied .stat-value')?.textContent).toBe('—')
    expect(page.querySelector('#queue-health .mini-value')?.textContent).toBe('—')
  })
})
