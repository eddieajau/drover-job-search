/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProviderError } from '../common/index.js'
import { toJob } from './toJob.js'

const seekHtml = readFileSync(resolve(import.meta.dirname, '../../../../.local/examples/seek.html'), 'utf-8')

const SEEK_URL = 'https://au.seek.com/job/93971606'

function mockFetch(html: string): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    text: async () => html,
  })
}

describe('toJob', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = mockFetch(seekHtml)
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a ProvidedJob with a markdown description', async () => {
    const job = await toJob(SEEK_URL)

    expect(job.provider).toBe('seek')
    expect(job.providerJobId).toBe('93971606')
    expect(job.title).toContain('Senior Project Manager')
    expect(job.url).toBe(SEEK_URL)
    expect(job.employmentType).toBe('full-time')
    expect(job.description).toBeTruthy()
    expect(job.description).not.toMatch(/<div/)
    expect(job.description).toMatch(/\*\*/)
  })

  it('throws ProviderError with fetch_failed for empty response', async () => {
    fetchSpy = vi.fn().mockResolvedValue({ status: 404, ok: false, text: async () => '' })
    vi.stubGlobal('fetch', fetchSpy)

    await expect(toJob(SEEK_URL)).rejects.toThrow(ProviderError)
    try {
      await toJob(SEEK_URL)
    } catch (e) {
      expect((e as ProviderError).code).toBe('fetch_failed')
    }
  })

  it('throws ProviderError with parse_failed for bad HTML', async () => {
    fetchSpy = mockFetch('<html>nothing')
    vi.stubGlobal('fetch', fetchSpy)

    await expect(toJob(SEEK_URL)).rejects.toThrow(ProviderError)
    try {
      await toJob(SEEK_URL)
    } catch (e) {
      expect((e as ProviderError).code).toBe('parse_failed')
    }
  })
})
