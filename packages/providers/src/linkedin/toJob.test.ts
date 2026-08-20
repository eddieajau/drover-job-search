/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProviderError } from '../common/index.js'
import { toJob } from './toJob.js'

const DETAIL_HTML = `
<div class="topcard__title">Staff Software Engineer</h1>
<div class="topcard__org-name-link" href="https://www.linkedin.com/company/globex">Globex Corporation</a>
<div class="topcard__flavor topcard__flavor--bullet">Sydney, Australia</span>
<div class="show-more-less-html__markup"><h2>About the role</h2><p>We build <strong>great</strong> things.</p></div>
<h3 class="description__job-criteria-subheader">Employment type</h3>
<span class="description__job-criteria-text">Full-time</span>
`

const CLOSED_HTML = `
<div class="topcard__flavor topcard__flavor--bullet">No longer accepting applications</div>
`

const LINKEDIN_URL = 'https://www.linkedin.com/jobs/view/4448084368'
const FULL_PAGE_URL = 'https://www.linkedin.com/jobs/view/4448084368'
const GUEST_API_FRAGMENT = '/jobs-guest/jobs/api/jobPosting'

function mockFetch(html: string): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    text: async () => html,
  })
}

function mockFetchByPattern(patterns: { url: string; html: string }[]): ReturnType<typeof vi.fn> {
  return vi.fn().mockImplementation(async (url: string) => {
    const match = patterns.find(p => url.includes(p.url))
    return {
      status: 200,
      ok: true,
      text: async () => match?.html ?? '',
    }
  })
}

describe('toJob', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = mockFetch(DETAIL_HTML)
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a ProvidedJob with a markdown description', async () => {
    const job = await toJob(LINKEDIN_URL)

    expect(job.provider).toBe('linkedin')
    expect(job.providerJobId).toBe('4448084368')
    expect(job.title).toBe('Staff Software Engineer')
    expect(job.companyName).toBe('Globex Corporation')
    expect(job.location).toBe('Sydney, Australia')
    expect(job.employmentType).toBe('full-time')
    expect(job.description).toBeTruthy()
    expect(job.description).not.toMatch(/<div/)
    expect(job.description).toMatch(/\*\*/)
  })

  it('throws ProviderError with fetch_failed for empty response', async () => {
    fetchSpy = vi.fn().mockResolvedValue({ status: 404, ok: false, text: async () => '' })
    vi.stubGlobal('fetch', fetchSpy)

    await expect(toJob(LINKEDIN_URL)).rejects.toThrow(ProviderError)
    try {
      await toJob(LINKEDIN_URL)
    } catch (e) {
      expect((e as ProviderError).code).toBe('fetch_failed')
    }
  })

  it('throws ProviderError with job_closed for closed listings', async () => {
    fetchSpy = mockFetchByPattern([
      { url: GUEST_API_FRAGMENT, html: CLOSED_HTML },
      { url: FULL_PAGE_URL, html: CLOSED_HTML },
    ])
    vi.stubGlobal('fetch', fetchSpy)

    await expect(toJob(LINKEDIN_URL)).rejects.toThrow(ProviderError)
    try {
      await toJob(LINKEDIN_URL)
    } catch (e) {
      expect((e as ProviderError).code).toBe('job_closed')
    }
  })

  it('falls back to full page when guest API reports closed', async () => {
    fetchSpy = mockFetchByPattern([
      { url: GUEST_API_FRAGMENT, html: CLOSED_HTML },
      { url: FULL_PAGE_URL, html: DETAIL_HTML },
    ])
    vi.stubGlobal('fetch', fetchSpy)

    const job = await toJob(LINKEDIN_URL)

    expect(job.provider).toBe('linkedin')
    expect(job.providerJobId).toBe('4448084368')
    expect(job.title).toBe('Staff Software Engineer')
    expect(job.companyName).toBe('Globex Corporation')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('throws job_closed when full-page fallback also returns closed', async () => {
    fetchSpy = mockFetchByPattern([
      { url: GUEST_API_FRAGMENT, html: CLOSED_HTML },
      { url: FULL_PAGE_URL, html: CLOSED_HTML },
    ])
    vi.stubGlobal('fetch', fetchSpy)

    await expect(toJob(LINKEDIN_URL)).rejects.toThrow(ProviderError)
    try {
      await toJob(LINKEDIN_URL)
    } catch (e) {
      expect((e as ProviderError).code).toBe('job_closed')
    }
  })
})
