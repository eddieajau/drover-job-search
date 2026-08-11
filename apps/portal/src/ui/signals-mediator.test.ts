/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetSignalsMediatorForTesting, initSignalsMediator } from './signals-mediator.js'
import './pages/jobs/index.js'
import './pages/signals/index.js'

function mockFetch(ok: boolean): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, json: async () => ({}) }))
  )
}

function mockSeedFetch(created: number, rules: unknown[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ created }) }
      }
      if (url === '/api/rules') {
        return { ok: true, json: async () => rules }
      }
      return { ok: false, status: 404 }
    })
  )
}

describe('signals-mediator flag wiring', () => {
  beforeEach(() => {
    document.body.innerHTML = '<jobs-page></jobs-page>'
  })

  afterEach(() => {
    _resetSignalsMediatorForTesting()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('posts to the new flag URL when job-card:flag fires', async () => {
    mockFetch(true)
    initSignalsMediator()

    window.dispatchEvent(new CustomEvent('job-card:flag', { detail: { jobId: 1, providerJobId: 'job-1' } }))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/jobs/1/flag', {
      method: 'POST',
    })
  })

  it('requests a jobs refresh after a successful flag so cards reflect queued', async () => {
    mockFetch(true)
    initSignalsMediator()

    const refreshListener = vi.fn()
    window.addEventListener('jobs:refresh-request', refreshListener)

    window.dispatchEvent(new CustomEvent('job-card:flag', { detail: { jobId: 1, providerJobId: 'job-1' } }))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(refreshListener).toHaveBeenCalled()
    window.removeEventListener('jobs:refresh-request', refreshListener)
  })

  it('skips the refresh when the analysis-queue POST fails', async () => {
    mockFetch(false)
    initSignalsMediator()

    const refreshListener = vi.fn()
    window.addEventListener('jobs:refresh-request', refreshListener)

    window.dispatchEvent(new CustomEvent('job-card:flag', { detail: { jobId: 1, providerJobId: 'job-1' } }))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(refreshListener).not.toHaveBeenCalled()
    window.removeEventListener('jobs:refresh-request', refreshListener)
  })
})

describe('signals-mediator seed wiring', () => {
  beforeEach(() => {
    document.body.innerHTML = '<signals-page></signals-page>'
  })

  afterEach(() => {
    _resetSignalsMediatorForTesting()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('POSTs to seed-from-facts, refreshes the rules, and shows the created count', async () => {
    mockSeedFetch(2, [
      {
        id: 1,
        ruleName: 'gap-fact-1',
        ruleCategory: 'regex_title',
        pattern: '(?i)\\bjava\\b',
        signalType: 'dealbreaker',
        enabled: true,
        createdAt: '2026-08-05 00:00:00',
        updatedAt: '2026-08-05 00:00:00',
      },
    ])
    initSignalsMediator()

    window.dispatchEvent(new CustomEvent('signals-page:seed'))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/rules/seed-from-facts', { method: 'POST' })
    const page = document.querySelector('signals-page')
    expect(page?.querySelectorAll('.rule-row').length).toBe(1)
    expect(page?.querySelector('#seed-notice')?.textContent).toContain('Created 2 rules from gap facts')
    expect(page?.querySelector<HTMLButtonElement>('#btn-seed-rules')?.disabled).toBe(false)
  })

  it('restores the button and shows a failure notice when the POST fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    )
    initSignalsMediator()

    window.dispatchEvent(new CustomEvent('signals-page:seed'))
    await new Promise(resolve => setTimeout(resolve, 0))

    const page = document.querySelector('signals-page')
    expect(page?.querySelector('#seed-notice')?.textContent).toContain('Seeding failed')
    expect(page?.querySelector<HTMLButtonElement>('#btn-seed-rules')?.disabled).toBe(false)
  })
})
