/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProviderError } from './common/index.js'
import { importJob, LINKEDIN_URL_RE, SEEK_URL_RE } from './index.js'

const seekHtml = readFileSync(resolve(import.meta.dirname, '../../../.local/examples/seek.html'), 'utf-8')

const SEEK_URL = 'https://au.seek.com/job/93971606'
const NON_SEEK_URL = 'https://example.com/job/123'
const SEEK_URL_BAD = 'https://au.seek.com/job/abc'

const LINKEDIN_URL = 'https://www.linkedin.com/jobs/view/4448084368/'
const LINKEDIN_URL_NO_SLASH = 'https://www.linkedin.com/jobs/view/4448084368'

const LINKEDIN_DETAIL_HTML = `
<div class="topcard__title">Staff Software Engineer</h1>
<div class="topcard__org-name-link" href="https://www.linkedin.com/company/globex">Globex Corporation</a>
<div class="topcard__flavor topcard__flavor--bullet">Sydney, Australia</span>
<div class="show-more-less-html__markup"><h2>About the role</h2><p>We build <strong>great</strong> things.</p></div>
<h3 class="description__job-criteria-subheader">Employment type</h3>
<span class="description__job-criteria-text">Full-time</span>
`

const LINKEDIN_CLOSED_HTML = `
<div class="topcard__flavor topcard__flavor--bullet">No longer accepting applications</div>
`

function mockHtmlFetch(seekContent: string, linkedinContent: string = LINKEDIN_DETAIL_HTML): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.includes('linkedin.com/jobs-guest') ? linkedinContent : seekContent
      return {
        ok: true,
        text: async () => body,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
      }
    })
  )
}

describe('importJob', () => {
  beforeEach(() => {
    mockHtmlFetch(seekHtml)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a ProvidedJob for a valid Seek URL', async () => {
    const job = await importJob(SEEK_URL)

    expect(job.provider).toBe('seek')
    expect(job.providerJobId).toBe('93971606')
    expect(job.title).toContain('Senior Project Manager')
    expect(job.url).toBe(SEEK_URL)
    expect(job.description).toBeTruthy()
    expect(job.description).not.toMatch(/<div/)
  })

  it('returns a ProvidedJob for a LinkedIn URL', async () => {
    const job = await importJob(LINKEDIN_URL)

    expect(job.provider).toBe('linkedin')
    expect(job.providerJobId).toBe('4448084368')
    expect(job.title).toBe('Staff Software Engineer')
    expect(job.companyName).toBe('Globex Corporation')
    expect(job.description).toContain('**great**')
    expect(job.description).not.toMatch(/<div/)
  })

  it('returns a ProvidedJob for a LinkedIn URL without trailing slash', async () => {
    const job = await importJob(LINKEDIN_URL_NO_SLASH)

    expect(job.provider).toBe('linkedin')
    expect(job.providerJobId).toBe('4448084368')
  })

  it('throws ProviderError with unsupported_url for a non-provider URL', async () => {
    await expect(importJob(NON_SEEK_URL)).rejects.toThrow(ProviderError)
    try {
      await importJob(NON_SEEK_URL)
    } catch (e) {
      expect((e as ProviderError).code).toBe('unsupported_url')
    }
  })

  it('throws ProviderError with unsupported_url for a Seek URL with non-numeric id', async () => {
    await expect(importJob(SEEK_URL_BAD)).rejects.toThrow(ProviderError)
    try {
      await importJob(SEEK_URL_BAD)
    } catch (e) {
      expect((e as ProviderError).code).toBe('unsupported_url')
    }
  })

  it('throws ProviderError with fetch_failed when htmlFetch returns empty string', async () => {
    vi.restoreAllMocks()
    mockHtmlFetch('')

    await expect(importJob(SEEK_URL)).rejects.toThrow(ProviderError)
    try {
      await importJob(SEEK_URL)
    } catch (e) {
      expect((e as ProviderError).code).toBe('fetch_failed')
    }
  })

  it('throws ProviderError with job_closed for a closed LinkedIn job', async () => {
    vi.restoreAllMocks()
    mockHtmlFetch(seekHtml, LINKEDIN_CLOSED_HTML)

    await expect(importJob(LINKEDIN_URL)).rejects.toThrow(ProviderError)
    try {
      await importJob(LINKEDIN_URL)
    } catch (e) {
      expect((e as ProviderError).code).toBe('job_closed')
    }
  })

  it('exports SEEK_URL_RE and LINKEDIN_URL_RE for consumer reuse', () => {
    expect(SEEK_URL_RE.test(SEEK_URL)).toBe(true)
    expect(LINKEDIN_URL_RE.test(LINKEDIN_URL)).toBe(true)
  })
})
