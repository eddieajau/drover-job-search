/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { SEARCH_CARDS_HTML } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type SearchLogger } from '../common/index.js'
import { detail } from './detail.js'
import { SEARCH_URL, type JobDetail } from './parse.js'
import { search } from './search.js'

vi.mock('./detail.js', () => ({ detail: vi.fn() }))

function jobDetail(id: string, workplaceType: string | null, description: string | null): JobDetail {
  return {
    id,
    title: 'T',
    company: null,
    companyUrl: null,
    location: null,
    date: null,
    url: `https://www.linkedin.com/jobs/view/${id}`,
    description,
    seniority: null,
    employmentType: null,
    jobFunction: null,
    industries: null,
    workplaceType,
    applyUrl: null,
    closed: false,
  }
}

describe('search logging', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => SEARCH_CARDS_HTML,
    })
    vi.stubGlobal('fetch', fetchSpy)
    vi.mocked(detail).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits a per-page response trace log and a per-card debug log', async () => {
    const logger: SearchLogger = { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() }

    const result = await search({ query: 'engineer', location: 'Brisbane', jobage: 14, pages: 1, logger })

    const url = `${SEARCH_URL}?keywords=engineer&location=Brisbane&f_TPR=r1209600&start=0`

    expect(logger.trace).toHaveBeenCalledWith(
      { page: 1, url, htmlLength: SEARCH_CARDS_HTML.length, htmlPreview: SEARCH_CARDS_HTML.slice(0, 200) },
      'seeMoreJobPostings response'
    )

    expect(result.count).toBe(2)
    expect(logger.debug).toHaveBeenCalledWith(
      {
        page: 1,
        providerJobId: '40001',
        title: 'Senior Software Engineer',
        company: 'Acme Corp',
        location: 'Brisbane, Queensland, Australia',
      },
      'job card'
    )
    expect(logger.debug).toHaveBeenCalledWith(
      {
        page: 1,
        providerJobId: '40002',
        title: 'DevOps Engineer',
        company: 'Globex',
        location: 'Melbourne, Victoria, Australia',
      },
      'job card'
    )
  })
})

describe('search verify decision logging', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => SEARCH_CARDS_HTML,
    })
    vi.stubGlobal('fetch', fetchSpy)
    vi.mocked(detail).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs each screened card and keeps only matching workplaces', async () => {
    vi.mocked(detail).mockImplementation(async ({ id }) =>
      id === '40001' ? jobDetail('40001', 'onsite', 'CBD office role') : jobDetail('40002', 'remote', null)
    )

    const logger: SearchLogger = { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() }

    const result = await search({
      query: 'engineer',
      location: 'Brisbane',
      jobage: 14,
      pages: 1,
      workType: 'remote',
      logger,
    })

    expect(logger.debug).toHaveBeenCalledWith(
      {
        providerJobId: '40001',
        target: 'remote',
        criteriaWorkplaceType: 'onsite',
        classified: 'onsite',
        source: 'criteria',
        kept: false,
        descriptionExcerpt: 'CBD office role',
      },
      'verify decision'
    )
    expect(logger.debug).toHaveBeenCalledWith(
      {
        providerJobId: '40002',
        target: 'remote',
        criteriaWorkplaceType: 'remote',
        classified: 'remote',
        source: 'criteria',
        kept: true,
        descriptionExcerpt: null,
      },
      'verify decision'
    )

    expect(result.results).toHaveLength(1)
    expect(result.results[0].id).toBe('40002')
    expect(result.results[0].workplace).toBe('remote')
  })

  it('classifies from the description when no criteria row exists and logs the source', async () => {
    vi.mocked(detail).mockImplementation(async ({ id }) =>
      id === '40001'
        ? jobDetail('40001', null, 'This is a fully remote role')
        : jobDetail('40002', null, 'Work from Home Equipment perk')
    )

    const logger: SearchLogger = { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() }

    const result = await search({
      query: 'engineer',
      location: 'Brisbane',
      jobage: 14,
      pages: 1,
      workType: 'remote',
      logger,
    })

    expect(logger.debug).toHaveBeenCalledWith(
      {
        providerJobId: '40001',
        target: 'remote',
        criteriaWorkplaceType: null,
        classified: 'remote',
        source: 'description',
        kept: true,
        descriptionExcerpt: 'This is a fully remote role',
      },
      'verify decision'
    )
    expect(logger.debug).toHaveBeenCalledWith(
      {
        providerJobId: '40002',
        target: 'remote',
        criteriaWorkplaceType: null,
        classified: null,
        source: null,
        kept: false,
        descriptionExcerpt: 'Work from Home Equipment perk',
      },
      'verify decision'
    )

    expect(result.results).toHaveLength(1)
    expect(result.results[0].id).toBe('40001')
    expect(result.results[0].workplace).toBe('remote')
  })

  it('logs a null detail as a dropped card', async () => {
    vi.mocked(detail).mockResolvedValue(null)

    const logger: SearchLogger = { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() }

    const result = await search({
      query: 'engineer',
      location: 'Brisbane',
      jobage: 14,
      pages: 1,
      workType: 'remote',
      logger,
    })

    expect(logger.debug).toHaveBeenCalledWith(
      {
        providerJobId: '40001',
        target: 'remote',
        criteriaWorkplaceType: null,
        classified: null,
        source: null,
        kept: false,
        descriptionExcerpt: null,
      },
      'verify decision'
    )
    expect(result.results).toHaveLength(0)
  })
})
