/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { _resetFactsMediatorForTesting, initFactsMediator } from './facts-mediator.js'
import './pages/facts/index.js'
import type { FactEditPage } from './pages/facts/fact-edit-page.js'
import './pages/facts/fact-edit-page.js'
import type { FactIngestPage } from './pages/facts/fact-ingest-page.js'
import './pages/facts/fact-ingest-page.js'
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

function mockFetchWithMethods(routes: Record<string, { ok: boolean; data?: unknown }>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      for (const [pattern, handler] of Object.entries(routes)) {
        if (url.includes(pattern)) {
          return { ok: handler.ok, json: async () => handler.data }
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
    vi.unstubAllGlobals()
    vi.useRealTimers()
    document.body.innerHTML = ''
    window.location.hash = ''
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

  it('fetches a fact by id when fact-edit-page:ready fires with an id in the hash', async () => {
    mockFetch({ '/api/facts?id=5': factsData[0] })
    window.location.hash = '#facts/edit?id=5'
    initFactsMediator()
    const page = document.createElement('fact-edit-page') as FactEditPage
    document.body.appendChild(page)

    window.dispatchEvent(new CustomEvent('fact-edit-page:ready'))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/facts?id=5')
  })

  it('leaves the form blank when fact-edit-page:ready fires without an id', async () => {
    mockFetch({})
    window.location.hash = '#facts/edit'
    initFactsMediator()
    const page = document.createElement('fact-edit-page') as FactEditPage
    document.body.appendChild(page)

    window.dispatchEvent(new CustomEvent('fact-edit-page:ready'))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('POSTs a new fact on fact-edit-page:save when id is absent', async () => {
    mockFetchWithMethods({ '/api/facts': { ok: true } })
    initFactsMediator()
    const page = document.createElement('fact-edit-page') as FactEditPage
    document.body.appendChild(page)

    window.dispatchEvent(
      new CustomEvent('fact-edit-page:save', {
        detail: {
          label: 'TypeScript',
          category: 'skill',
          detail: '',
          evidenceType: '',
          confidence: 'stated',
          startedAt: '',
          endedAt: '',
          period: '',
          active: true,
        },
      })
    )
    await new Promise(resolve => setTimeout(resolve, 0))

    const calls = vi.mocked(fetch).mock.calls
    const postCall = calls.find(([, init]) => (init as RequestInit)?.method === 'POST')
    expect(postCall).toBeDefined()
    expect(String(postCall![0])).toBe('/api/facts')
  })

  it('PATCHes an existing fact on fact-edit-page:save when id is present', async () => {
    mockFetchWithMethods({ '/api/facts/5': { ok: true } })
    initFactsMediator()
    const page = document.createElement('fact-edit-page') as FactEditPage
    document.body.appendChild(page)

    window.dispatchEvent(
      new CustomEvent('fact-edit-page:save', {
        detail: {
          id: 5,
          label: 'TypeScript',
          category: 'skill',
          detail: '',
          evidenceType: '',
          confidence: 'stated',
          startedAt: '',
          endedAt: '',
          period: '',
          active: true,
        },
      })
    )
    await new Promise(resolve => setTimeout(resolve, 0))

    const calls = vi.mocked(fetch).mock.calls
    const patchCall = calls.find(([, init]) => (init as RequestInit)?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    expect(String(patchCall![0])).toBe('/api/facts/5')
  })

  it('stays on the form when the save fetch fails', async () => {
    mockFetchWithMethods({ '/api/facts': { ok: false } })
    initFactsMediator()
    document.createElement('fact-edit-page')
    document.body.appendChild(document.createElement('fact-edit-page'))

    const originalHash = window.location.hash
    window.dispatchEvent(
      new CustomEvent('fact-edit-page:save', {
        detail: {
          label: 'TypeScript',
          category: 'skill',
          detail: '',
          evidenceType: '',
          confidence: 'stated',
          startedAt: '',
          endedAt: '',
          period: '',
          active: true,
        },
      })
    )
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(window.location.hash).toBe(originalHash)
  })

  it('POSTs to /api/facts/ingest, polls the task, and shows the inserted result on completion', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 202, json: async () => ({ taskId: 7 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 7, topic: 'slice_resume', completedAt: null, errorMessage: null, result: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 7,
          topic: 'slice_resume',
          completedAt: '2026-08-11 10:00:00',
          errorMessage: null,
          result: { inserted: 3, superseded: 1 },
        }),
      })
    vi.stubGlobal('fetch', fetchMock)
    initFactsMediator()
    const page = document.createElement('fact-ingest-page') as FactIngestPage
    document.body.appendChild(page)

    const setBusySpy = vi.spyOn(page, 'setBusy')
    const setResultSpy = vi.spyOn(page, 'setResult')

    window.dispatchEvent(new CustomEvent('fact-ingest-page:ingest', { detail: { resume: 'My resume text' } }))
    await vi.advanceTimersByTimeAsync(0)

    expect(setBusySpy).toHaveBeenCalledWith(true)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/facts/ingest',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resume: 'My resume text' }),
      })
    )
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks/7', expect.anything())

    await vi.advanceTimersByTimeAsync(2000)

    expect(setResultSpy).toHaveBeenCalledWith({ inserted: 3, superseded: 1 })
    expect(setBusySpy).toHaveBeenCalledWith(false)
  })

  it('shows an error result when the polled task reports an errorMessage', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 202, json: async () => ({ taskId: 7 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 7,
          topic: 'slice_resume',
          completedAt: '2026-08-11 10:00:00',
          errorMessage: 'passes failed to parse after retry',
          result: null,
        }),
      })
    vi.stubGlobal('fetch', fetchMock)
    initFactsMediator()
    const page = document.createElement('fact-ingest-page') as FactIngestPage
    document.body.appendChild(page)

    const setResultSpy = vi.spyOn(page, 'setResult')

    window.dispatchEvent(new CustomEvent('fact-ingest-page:ingest', { detail: { resume: 'empty resume' } }))
    await vi.advanceTimersByTimeAsync(0)

    expect(setResultSpy).toHaveBeenCalledWith({ error: 'passes failed to parse after retry' })
  })

  it('sets a generic error result on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network error')
      })
    )
    initFactsMediator()
    const page = document.createElement('fact-ingest-page') as FactIngestPage
    document.body.appendChild(page)

    const setResultSpy = vi.spyOn(page, 'setResult')

    window.dispatchEvent(new CustomEvent('fact-ingest-page:ingest', { detail: { resume: 'some text' } }))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(setResultSpy).toHaveBeenCalledWith({ error: 'ingestion failed' })
  })
})
