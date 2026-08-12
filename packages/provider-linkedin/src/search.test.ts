import { SEARCH_CARDS_HTML } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SEARCH_URL, type SearchLogger } from './helpers.js'
import { search } from './search.js'

describe('search logging', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => SEARCH_CARDS_HTML,
    })
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits a per-page response debug log and a per-card info log', async () => {
    const logger: SearchLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn() }

    const result = await search({ query: 'engineer', location: 'Brisbane', jobage: 14, pages: 1, logger })

    const url = `${SEARCH_URL}?keywords=engineer&location=Brisbane&f_TPR=r1209600&start=0`

    expect(logger.debug).toHaveBeenCalledWith({ page: 1, url, html: SEARCH_CARDS_HTML }, 'seeMoreJobPostings response')

    expect(result.count).toBe(2)
    expect(logger.info).toHaveBeenCalledWith(
      {
        page: 1,
        providerJobId: '40001',
        title: 'Senior Software Engineer',
        company: 'Acme Corp',
        location: 'Brisbane, Queensland, Australia',
      },
      'job card'
    )
    expect(logger.info).toHaveBeenCalledWith(
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
