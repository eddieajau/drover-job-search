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
      status: 'new',
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
      status: 'new',
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
      status: 'new',
    },
  ],
}

type JobSignals = {
  signalCount?: number
  gated?: boolean
  dimensions?: Record<string, number>
  baseScore?: number
}

function jobsResponse(
  signals: Record<string, JobSignals> = {},
  statuses: Record<string, string> = {}
): typeof mockJobsResponse {
  return {
    count: 3,
    results: mockJobsResponse.results.map(job => ({
      ...job,
      status: statuses[job.providerJobId] ?? job.status,
      signals: {
        signalCount: 0,
        gated: false,
        dimensions: {},
        baseScore: 0,
        ...signals[job.providerJobId],
      },
    })),
  }
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
    window.location.hash = ''
  })

  afterEach(() => {
    _resetJobsMediatorForTesting()
    vi.restoreAllMocks()
    window.location.hash = ''
  })

  it('loads each job with its joined summary in a single /api/jobs request', async () => {
    mockFetch({ '/api/jobs': jobsResponse() })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const calls = vi.mocked(fetch).mock.calls.map(([url]) => url)
    expect(calls).toEqual(['/api/jobs?limit=50&offset=0'])
  })

  it('reads the joined signal summary and attaches weighted netScore to jobs', async () => {
    mockFetch({
      '/api/jobs': jobsResponse({
        'job-1': {
          signalCount: 2,
          gated: false,
          dimensions: { technical: 75, experience: 75, behavioral: 75, career: 75 },
          baseScore: 0,
        },
        'job-2': {
          signalCount: 1,
          gated: false,
          dimensions: { technical: 10, experience: 10, behavioral: 10, career: 10 },
          baseScore: 0,
        },
        'job-3': { signalCount: 0, gated: false, dimensions: {}, baseScore: 0 },
      }),
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const cards = document.querySelectorAll('job-card')
    expect(cards.length).toBe(3)
    const badges = document.querySelectorAll('job-card .score')
    expect(badges.length).toBe(3)
    expect(badges[0].textContent).toBe('+75')
  })

  it('weights dimension sub-scores to the documented scale, not a naive sum', async () => {
    mockFetch({
      '/api/jobs': jobsResponse({
        'job-1': {
          signalCount: 4,
          gated: false,
          dimensions: { technical: 50, experience: 50, behavioral: 50, career: 50 },
          baseScore: 0,
        },
      }),
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const badge = document.querySelector('job-card .score')
    expect(badge?.textContent).toBe('+50')
  })

  it('ranks by weighted dimensions so heavier dimensions dominate', async () => {
    mockFetch({
      '/api/jobs': jobsResponse({
        'job-1': { signalCount: 2, gated: false, dimensions: { technical: 100 }, baseScore: 0 },
        'job-2': { signalCount: 2, gated: false, dimensions: { behavioral: 100 }, baseScore: 0 },
        'job-3': { signalCount: 0, gated: false, dimensions: {}, baseScore: 0 },
      }),
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const cards = document.querySelectorAll('job-card')
    expect(cards.length).toBe(3)
    const titles = Array.from(cards).map(c => c.querySelector('.job-title')?.textContent)
    expect(titles[0]).toBe('Staff Engineer')
    expect(titles[1]).toBe('Senior Developer')
    expect(titles[2]).toBe('Tech Lead')
  })

  it('excludes gated jobs from default list', async () => {
    mockFetch({
      '/api/jobs': jobsResponse({
        'job-1': {
          signalCount: 2,
          gated: false,
          dimensions: { technical: 75, experience: 75, behavioral: 75, career: 75 },
          baseScore: 0,
        },
        'job-2': {
          signalCount: 1,
          gated: false,
          dimensions: { technical: 10, experience: 10, behavioral: 10, career: 10 },
          baseScore: 0,
        },
        'job-3': { signalCount: 0, gated: true, dimensions: {}, baseScore: 0 },
      }),
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const cards = document.querySelectorAll('job-card')
    expect(cards.length).toBe(2)
    const titles = Array.from(cards).map(c => c.querySelector('.job-title')?.textContent)
    expect(titles).toContain('Staff Engineer')
    expect(titles).toContain('Senior Developer')
    expect(titles).not.toContain('Tech Lead')
  })

  it('auto-skips a gated job regardless of dimension scores', async () => {
    mockFetch({
      '/api/jobs': jobsResponse({
        'job-1': { signalCount: 0, gated: false, dimensions: {}, baseScore: 0 },
        'job-2': {
          signalCount: 4,
          gated: true,
          dimensions: { technical: 100, experience: 100, behavioral: 100, career: 100 },
          baseScore: 0,
        },
        'job-3': { signalCount: 0, gated: false, dimensions: {}, baseScore: 0 },
      }),
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const cards = document.querySelectorAll('job-card')
    expect(cards.length).toBe(2)
    const titles = Array.from(cards).map(c => c.querySelector('.job-title')?.textContent)
    expect(titles).not.toContain('Senior Developer')
  })

  it('sorts non-gated jobs by weighted netScore descending', async () => {
    mockFetch({
      '/api/jobs': jobsResponse({
        'job-1': {
          signalCount: 1,
          gated: false,
          dimensions: { technical: 20, experience: 20, behavioral: 20, career: 20 },
          baseScore: 0,
        },
        'job-2': {
          signalCount: 2,
          gated: false,
          dimensions: { technical: 80, experience: 80, behavioral: 80, career: 80 },
          baseScore: 0,
        },
        'job-3': {
          signalCount: 1,
          gated: false,
          dimensions: { technical: 50, experience: 50, behavioral: 50, career: 50 },
          baseScore: 0,
        },
      }),
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const cards = document.querySelectorAll('job-card')
    expect(cards.length).toBe(3)
    const titles = Array.from(cards).map(c => c.querySelector('.job-title')?.textContent)
    expect(titles[0]).toBe('Senior Developer')
    expect(titles[1]).toBe('Tech Lead')
    expect(titles[2]).toBe('Staff Engineer')
  })

  it('renders auto-skip badge for gated jobs when filter is auto-skip', async () => {
    mockFetch({
      '/api/jobs': jobsResponse({
        'job-1': {
          signalCount: 3,
          gated: true,
          dimensions: { technical: 100, experience: 100, behavioral: 100, career: 100 },
          baseScore: 0,
        },
        'job-2': {
          signalCount: 1,
          gated: false,
          dimensions: { technical: 10, experience: 10, behavioral: 10, career: 10 },
          baseScore: 0,
        },
      }),
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

    const cards = document.querySelectorAll('job-card')
    expect(cards.length).toBe(1)
    const badge = cards[0].querySelector('.score')
    expect(badge?.textContent).toBe('auto-skip')
    expect(cards[0].querySelector('.job-card')?.classList.contains('gated')).toBe(true)
  })

  it('handles jobs missing the summary fields gracefully', async () => {
    mockFetch({ '/api/jobs': mockJobsResponse })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const cards = document.querySelectorAll('job-card')
    expect(cards.length).toBe(3)
    const badges = document.querySelectorAll('job-card .score')
    expect(badges.length).toBe(0)
  })

  it('reads the server status and marks non-new jobs as seen', async () => {
    mockFetch({
      '/api/jobs': jobsResponse({}, { 'job-1': 'applied' }),
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const cards = document.querySelectorAll('job-card')
    expect(cards[0].hasAttribute('seen')).toBe(true)
    expect(cards[1].hasAttribute('seen')).toBe(false)
  })

  it('persists a status change via PATCH then refreshes from the server', async () => {
    mockFetch({
      '/api/jobs/1/status': { status: 'applied' },
      '/api/jobs': jobsResponse({}, { 'job-1': 'applied' }),
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    window.dispatchEvent(new CustomEvent('job-meta:status', { detail: { jobId: 1, status: 'applied' } }))
    await new Promise(resolve => setTimeout(resolve, 50))

    const calls = vi.mocked(fetch).mock.calls
    const patchCalls = calls.filter(([, init]) => init?.method === 'PATCH')
    expect(patchCalls).toHaveLength(1)
    const [patchUrl, patchInit] = patchCalls[0]
    expect(patchUrl).toBe('/api/jobs/1/status')
    expect(JSON.parse(String(patchInit?.body))).toEqual({ status: 'applied' })

    const refreshCalls = calls.filter(([url]) => url === '/api/jobs?limit=50&offset=0')
    expect(refreshCalls).toHaveLength(2)

    expect(document.querySelector('job-card[job-id="1"]')?.hasAttribute('seen')).toBe(true)
  })

  it('fetches the next page with limit and offset when next is clicked', async () => {
    mockFetch({
      '/api/jobs': { count: 100, limit: 50, offset: 0, results: jobsResponse().results },
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const pager = document.querySelector('pager-nav')
    expect(pager).not.toBeNull()
    pager?.setAttribute('page-size', '10')
    pager?.setAttribute('page', '1')
    pager?.setAttribute('total', '100')
    pager?.querySelector<HTMLButtonElement>('#pager-next')?.click()
    await new Promise(resolve => setTimeout(resolve, 50))

    const calls = vi.mocked(fetch).mock.calls.map(([url]) => url)
    expect(calls).toContain('/api/jobs?limit=10&offset=10')
  })

  it('updates the pager total from the response envelope', async () => {
    mockFetch({
      '/api/jobs': { count: 100, limit: 50, offset: 0, results: jobsResponse().results },
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(document.querySelector('pager-nav')?.getAttribute('total')).toBe('100')
  })

  it('disables next in the rendered DOM on the last page', async () => {
    mockFetch({
      '/api/jobs': { count: 100, limit: 10, offset: 90, results: jobsResponse().results },
    })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    window.dispatchEvent(new CustomEvent('pager:change', { detail: { page: 10, pageSize: 10 } }))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(document.querySelector('pager-nav')?.querySelector<HTMLButtonElement>('#pager-next')?.disabled).toBe(true)
  })

  it('updates the URL hash when a job is selected', async () => {
    mockFetch({ '/api/jobs': jobsResponse() })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    window.dispatchEvent(new CustomEvent('job-list:select', { detail: { jobId: 2 } }))
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(window.location.hash).toBe('#jobs?job=2')
  })

  it('seeds the selected job from the URL hash on load', async () => {
    window.location.hash = '#jobs?job=2'
    mockFetch({ '/api/jobs': jobsResponse() })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    const activeCard = document.querySelector('job-card[active]')
    expect(activeCard).not.toBeNull()
    expect(activeCard?.getAttribute('job-id')).toBe('2')
  })

  it('does not rewrite the hash when selecting the same job twice', async () => {
    mockFetch({ '/api/jobs': jobsResponse() })

    initJobsMediator()
    await new Promise(resolve => setTimeout(resolve, 50))

    window.dispatchEvent(new CustomEvent('job-list:select', { detail: { jobId: 1 } }))
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(window.location.hash).toBe('#jobs?job=1')

    const replaceStateSpy = vi.spyOn(history, 'replaceState')
    window.dispatchEvent(new CustomEvent('job-list:select', { detail: { jobId: 1 } }))
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(replaceStateSpy).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#jobs?job=1')
  })
})
