/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetJobsMediatorForTesting, initJobsMediator } from './jobs-mediator.js'
import './pages/jobs/index.js'

const mockJobsResponse = {
  count: 3,
  results: [
    {
      id: 1,
      providerJobId: 'job-1',
      title: 'Staff Engineer',
      companyName: 'Acme',
      url: 'https://li/job-1',
      location: 'Brisbane',
      postedAt: '2026-08-05',
      priority: 1,
      category: 'P1',
    },
    {
      id: 2,
      providerJobId: 'job-2',
      title: 'Senior Developer',
      companyName: 'Beta',
      url: 'https://li/job-2',
      location: 'Sydney',
      postedAt: '2026-08-04',
      priority: 2,
      category: 'P2',
    },
    {
      id: 3,
      providerJobId: 'job-3',
      title: 'Tech Lead',
      companyName: 'Gamma',
      url: 'https://li/job-3',
      location: 'Melbourne',
      postedAt: '2026-08-03',
      priority: 2,
      category: 'P2',
    },
  ],
}

function mockFetch(responses: Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      for (const [pattern, data] of Object.entries(responses)) {
        if (url.includes(pattern)) {
          return {
            ok: true,
            json: async () => data,
          }
        }
      }
      return { ok: false, status: 404 }
    })
  )
}

describe('jobs-mediator', () => {
  beforeEach(() => {
    document.body.innerHTML = '<jobs-page></jobs-page>'
  })

  afterEach(() => {
    _resetJobsMediatorForTesting()
    vi.restoreAllMocks()
  })

  it('fetches signal summaries and attaches netScore to jobs', async () => {
    mockFetch({
      '/api/jobs': mockJobsResponse,
      '/api/signals/summary': {
        'job-1': { netScore: 75, signalCount: 2, gated: false },
        'job-2': { netScore: 10, signalCount: 1, gated: false },
        'job-3': { netScore: 0, signalCount: 0, gated: false },
      },
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const cards = document.querySelectorAll('.card')
    expect(cards.length).toBe(3)
    const badges = document.querySelectorAll('.score-badge')
    expect(badges.length).toBe(3)
    expect(badges[0].textContent).toBe('+75')
  })

  it('excludes gated jobs from default list', async () => {
    mockFetch({
      '/api/jobs': mockJobsResponse,
      '/api/signals/summary': {
        'job-1': { netScore: 75, signalCount: 2, gated: false },
        'job-2': { netScore: 10, signalCount: 1, gated: false },
        'job-3': { netScore: 0, signalCount: 0, gated: true },
      },
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const cards = document.querySelectorAll('.card')
    expect(cards.length).toBe(2)
    const titles = Array.from(cards).map(c => c.querySelector('.card-title')?.textContent)
    expect(titles).toContain('Staff Engineer')
    expect(titles).toContain('Senior Developer')
    expect(titles).not.toContain('Tech Lead')
  })

  it('sorts non-gated jobs by netScore descending', async () => {
    mockFetch({
      '/api/jobs': mockJobsResponse,
      '/api/signals/summary': {
        'job-1': { netScore: 20, signalCount: 1, gated: false },
        'job-2': { netScore: 80, signalCount: 2, gated: false },
        'job-3': { netScore: 50, signalCount: 1, gated: false },
      },
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const cards = document.querySelectorAll('.card')
    expect(cards.length).toBe(3)
    const titles = Array.from(cards).map(c => c.querySelector('.card-title')?.textContent)
    expect(titles[0]).toBe('Senior Developer')
    expect(titles[1]).toBe('Tech Lead')
    expect(titles[2]).toBe('Staff Engineer')
  })

  it('renders auto-skip badge for gated jobs when filter is auto-skip', async () => {
    mockFetch({
      '/api/jobs': mockJobsResponse,
      '/api/signals/summary': {
        'job-1': { netScore: 100, signalCount: 3, gated: true },
        'job-2': { netScore: 10, signalCount: 1, gated: false },
      },
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const filterBar = document.querySelector('filter-bar')
    const scoreSelect = filterBar?.querySelector<HTMLSelectElement>('#filter-score')
    if (scoreSelect) {
      scoreSelect.value = 'auto-skip'
    }
    filterBar?.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise(resolve => setTimeout(resolve, 10))

    const cards = document.querySelectorAll('.card')
    expect(cards.length).toBe(1)
    const badge = cards[0].querySelector('.score-badge')
    expect(badge?.textContent).toBe('auto-skip')
    expect(cards[0].classList.contains('gated')).toBe(true)
  })

  it('handles missing signal summary gracefully', async () => {
    mockFetch({
      '/api/jobs': mockJobsResponse,
      '/api/signals/summary': {},
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const cards = document.querySelectorAll('.card')
    expect(cards.length).toBe(3)
    const badges = document.querySelectorAll('.score-badge')
    expect(badges.length).toBe(0)
  })
})
