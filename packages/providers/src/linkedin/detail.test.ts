/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { detail } from './detail.js'
import { DETAIL_URL } from './parse.js'

const DETAIL_HTML = `
<div class="topcard__title">Senior Engineer</h1>
<div class="topcard__org-name-link" href="https://www.linkedin.com/company/acme">Acme Corp</a>
<div class="topcard__flavor topcard__flavor--bullet">Brisbane, Australia</span>
<div class="show-more-less-html__markup">Build great things.</div>
`

function mockFetch(html: string): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    text: async () => html,
  })
}

describe('detail() id extraction', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = mockFetch(DETAIL_HTML)
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts the id from a trailing-slash view URL', async () => {
    await detail({ id: 'https://www.linkedin.com/jobs/view/4448084368/' })
    expect(fetchSpy).toHaveBeenCalledWith(`${DETAIL_URL}/4448084368`, expect.any(Object))
  })

  it('extracts the id from a view URL without a trailing slash', async () => {
    await detail({ id: 'https://www.linkedin.com/jobs/view/4448084368' })
    expect(fetchSpy).toHaveBeenCalledWith(`${DETAIL_URL}/4448084368`, expect.any(Object))
  })

  it('extracts the id from a trailing-slash view URL with a query string', async () => {
    await detail({ id: 'https://www.linkedin.com/jobs/view/4448084368/?refId=abc' })
    expect(fetchSpy).toHaveBeenCalledWith(`${DETAIL_URL}/4448084368`, expect.any(Object))
  })

  it('extracts the id from a slug + trailing-slash view URL', async () => {
    await detail({ id: 'https://www.linkedin.com/jobs/view/senior-engineer-4448084368/' })
    expect(fetchSpy).toHaveBeenCalledWith(`${DETAIL_URL}/4448084368`, expect.any(Object))
  })

  it('extracts the id from a URN', async () => {
    await detail({ id: 'urn:li:jobPosting:4448084368' })
    expect(fetchSpy).toHaveBeenCalledWith(`${DETAIL_URL}/4448084368`, expect.any(Object))
  })

  it('extracts a bare id', async () => {
    await detail({ id: '4448084368' })
    expect(fetchSpy).toHaveBeenCalledWith(`${DETAIL_URL}/4448084368`, expect.any(Object))
  })

  it('throws on invalid input', async () => {
    await expect(detail({ id: 'not-a-job-url' })).rejects.toThrow('Could not parse a job ID from "not-a-job-url"')
  })
})

describe('detail() return value', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = mockFetch(DETAIL_HTML)
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses the detail HTML into a JobDetail', async () => {
    const result = await detail({ id: 'https://www.linkedin.com/jobs/view/4448084368/' })
    expect(result).not.toBeNull()
    expect(result!.id).toBe('4448084368')
    expect(result!.title).toBe('Senior Engineer')
    expect(result!.description).toBe('Build great things.')
    expect(result!.closed).toBe(false)
  })

  it('returns null when fetch yields a 404 (empty html)', async () => {
    fetchSpy = vi.fn().mockResolvedValue({ status: 404, ok: false, text: async () => '' })
    vi.stubGlobal('fetch', fetchSpy)
    const result = await detail({ id: '4448084368' })
    expect(result).toBeNull()
  })
})
