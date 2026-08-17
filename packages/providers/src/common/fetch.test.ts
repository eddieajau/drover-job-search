/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { htmlFetch, silentLogger } from './fetch.js'

function mockFetch(response: { status: number; ok: boolean; statusText?: string }): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    status: response.status,
    ok: response.ok,
    statusText: response.statusText ?? '',
    text: async () => '<html></html>',
  }))
}

describe('silentLogger', () => {
  it('is a no-op for every level', () => {
    const spy = vi.fn()
    silentLogger.trace(spy)
    silentLogger.debug(spy, 'msg')
    silentLogger.info(spy, 'msg')
    silentLogger.warn(spy, 'msg')
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('htmlFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the response body on success', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 200, ok: true }))
    await expect(htmlFetch('https://example.com')).resolves.toBe('<html></html>')
  })

  it('returns an empty string on a 404', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 404, ok: false, statusText: 'Not Found' }))
    await expect(htmlFetch('https://example.com')).resolves.toBe('')
  })

  it('throws on a non-404 error status', async () => {
    // 400 is a non-retryable error status, so it throws immediately.
    vi.stubGlobal('fetch', mockFetch({ status: 400, ok: false, statusText: 'Bad Request' }))
    await expect(htmlFetch('https://example.com')).rejects.toThrow()
  })
})
