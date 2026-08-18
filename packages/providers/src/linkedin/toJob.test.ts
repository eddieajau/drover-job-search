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
    fetchSpy = mockFetch(DETAIL_HTML)
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a ProvidedJob with a markdown description', async () => {
    const job = await toJob('4448084368')

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

    await expect(toJob('4448084368')).rejects.toThrow(ProviderError)
    try {
      await toJob('4448084368')
    } catch (e) {
      expect((e as ProviderError).code).toBe('fetch_failed')
    }
  })

  it('throws ProviderError with job_closed for closed listings', async () => {
    fetchSpy = mockFetch(CLOSED_HTML)
    vi.stubGlobal('fetch', fetchSpy)

    await expect(toJob('4448084368')).rejects.toThrow(ProviderError)
    try {
      await toJob('4448084368')
    } catch (e) {
      expect((e as ProviderError).code).toBe('job_closed')
    }
  })
})
