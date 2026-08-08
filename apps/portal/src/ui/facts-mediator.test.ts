/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { _resetFactsMediatorForTesting, initFactsMediator } from './facts-mediator.js'
import './pages/facts/index.js'
import type { FactsPage } from './pages/facts/index.js'

const factsData = [
  {
    id: 1,
    category: 'skill',
    label: 'TypeScript',
    detail: null,
    evidenceType: null,
    startedAt: null,
    endedAt: null,
    period: null,
    confidence: 'high',
    active: true,
    createdAt: '2026-08-05 00:00:00',
    updatedAt: '2026-08-05 00:00:00',
  },
]

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

describe('facts-mediator', () => {
  afterEach(() => {
    _resetFactsMediatorForTesting()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('fetches facts when facts-page becomes ready and pushes them in', async () => {
    mockFetch({ '/api/facts': factsData })
    initFactsMediator()
    const page = document.createElement('facts-page') as FactsPage
    document.body.appendChild(page)

    window.dispatchEvent(new CustomEvent('facts-page:ready'))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/facts')
    expect(page.querySelector('.page-count')?.textContent).toBe('1 facts · 1 active')
    expect(page.querySelector('fact-row')).not.toBeNull()
  })

  it('renders an empty state when the facts fetch fails', async () => {
    mockFetch({})
    initFactsMediator()
    const page = document.createElement('facts-page') as FactsPage
    document.body.appendChild(page)

    window.dispatchEvent(new CustomEvent('facts-page:ready'))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(page.querySelector('.page-count')?.textContent).toBe('0 facts · 0 active')
    expect(page.querySelector('.empty-state')).not.toBeNull()
  })

  it('fetches with category filter on facts-page:filter', async () => {
    mockFetch({ '/api/facts': factsData })
    initFactsMediator()
    const page = document.createElement('facts-page') as FactsPage
    document.body.appendChild(page)
    await new Promise(resolve => setTimeout(resolve, 0))

    window.dispatchEvent(new CustomEvent('facts-page:filter', { detail: { category: 'skill', active: '' } }))
    await new Promise(resolve => setTimeout(resolve, 0))

    const calls = vi.mocked(fetch).mock.calls
    const filterCall = calls.find(([url]) => String(url).includes('category=skill'))
    expect(filterCall).toBeDefined()
  })

  it('fetches with active filter on facts-page:filter', async () => {
    mockFetch({ '/api/facts': factsData })
    initFactsMediator()
    const page = document.createElement('facts-page') as FactsPage
    document.body.appendChild(page)
    await new Promise(resolve => setTimeout(resolve, 0))

    window.dispatchEvent(new CustomEvent('facts-page:filter', { detail: { category: '', active: '1' } }))
    await new Promise(resolve => setTimeout(resolve, 0))

    const calls = vi.mocked(fetch).mock.calls
    const filterCall = calls.find(([url]) => String(url).includes('active=1'))
    expect(filterCall).toBeDefined()
  })
})
