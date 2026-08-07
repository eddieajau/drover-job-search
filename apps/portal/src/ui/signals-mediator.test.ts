/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetSignalsMediatorForTesting, initSignalsMediator } from './signals-mediator.js'
import './pages/jobs/index.js'

function mockFetch(ok: boolean): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, json: async () => ({}) }))
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

  it('posts to the analysis queue when job-card:flag fires', async () => {
    mockFetch(true)
    initSignalsMediator()

    window.dispatchEvent(new CustomEvent('job-card:flag', { detail: { jobId: 1, providerJobId: 'job-1' } }))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/analysis-queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerJobId: 'job-1' }),
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
