/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProviderError, type ProvidedJob } from './common/index.js'
import { importJob, LINKEDIN_URL_RE, SEEK_URL_RE } from './index.js'
import { provider as linkedinProvider } from './linkedin/index.js'
import { provider as seekProvider } from './seek/index.js'

const SEEK_URL = 'https://au.seek.com/job/93971606'
const NON_SEEK_URL = 'https://example.com/job/123'
const SEEK_URL_BAD = 'https://au.seek.com/job/abc'

const LINKEDIN_URL = 'https://www.linkedin.com/jobs/view/4448084368/'
const LINKEDIN_URL_NO_SLASH = 'https://www.linkedin.com/jobs/view/4448084368'

const SEEK_JOB: ProvidedJob = {
  provider: 'seek',
  providerJobId: '93971606',
  title: 'Senior Project Manager',
  companyName: 'Acme Corp',
  url: SEEK_URL,
  location: 'Sydney, Australia',
  workplaceType: null,
  employmentType: 'full-time',
  postedAt: null,
  description: '# Senior Project Manager\n\nWe build things.',
}

const LINKEDIN_JOB: ProvidedJob = {
  provider: 'linkedin',
  providerJobId: '4448084368',
  title: 'Staff Software Engineer',
  companyName: 'Globex Corporation',
  url: LINKEDIN_URL,
  location: 'Sydney, Australia',
  workplaceType: null,
  employmentType: 'full-time',
  postedAt: null,
  description: '# Staff Software Engineer\n\nWe build **great** things.',
}

describe('importJob', () => {
  let seekToJobSpy: ReturnType<typeof vi.fn>
  let linkedinToJobSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    seekToJobSpy = vi.fn().mockResolvedValue(SEEK_JOB)
    linkedinToJobSpy = vi.fn().mockResolvedValue(LINKEDIN_JOB)
    vi.spyOn(seekProvider, 'toJob').mockImplementation(seekToJobSpy)
    vi.spyOn(linkedinProvider, 'toJob').mockImplementation(linkedinToJobSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a ProvidedJob for a valid Seek URL', async () => {
    const job = await importJob(SEEK_URL)

    expect(job.provider).toBe('seek')
    expect(job.providerJobId).toBe('93971606')
    expect(seekToJobSpy).toHaveBeenCalledWith(SEEK_URL, expect.anything())
    expect(linkedinToJobSpy).not.toHaveBeenCalled()
  })

  it('returns a ProvidedJob for a LinkedIn URL', async () => {
    const job = await importJob(LINKEDIN_URL)

    expect(job.provider).toBe('linkedin')
    expect(job.providerJobId).toBe('4448084368')
    expect(linkedinToJobSpy).toHaveBeenCalledWith(LINKEDIN_URL, expect.anything())
    expect(seekToJobSpy).not.toHaveBeenCalled()
  })

  it('returns a ProvidedJob for a LinkedIn URL without trailing slash', async () => {
    const job = await importJob(LINKEDIN_URL_NO_SLASH)

    expect(job.provider).toBe('linkedin')
    expect(job.providerJobId).toBe('4448084368')
    expect(linkedinToJobSpy).toHaveBeenCalledWith(LINKEDIN_URL_NO_SLASH, expect.anything())
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

  it('throws ProviderError with fetch_failed when provider throws', async () => {
    seekToJobSpy.mockRejectedValue(new ProviderError('fetch_failed', 'Could not fetch job page'))

    await expect(importJob(SEEK_URL)).rejects.toThrow(ProviderError)
    try {
      await importJob(SEEK_URL)
    } catch (e) {
      expect((e as ProviderError).code).toBe('fetch_failed')
    }
  })

  it('throws ProviderError with job_closed for a closed LinkedIn job', async () => {
    linkedinToJobSpy.mockRejectedValue(new ProviderError('job_closed', 'This job is no longer accepting applications'))

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
