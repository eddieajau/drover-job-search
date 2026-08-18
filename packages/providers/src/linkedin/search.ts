// Adapted from linkedin-search-cli (MIT License).
// Original: https://github.com/MadsLorentzen/ai-job-search/tree/main/.agents/skills/linkedin-search/cli
//
// Copyright (c) 2025 MadsLorentzen
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { htmlFetch, silentLogger, type SearchLogger } from '../common/index.js'
import { detail } from './detail.js'
import {
  SEARCH_URL,
  parseJobCards,
  jobageToTPR,
  workTypeFlag,
  jobTypeFlag,
  classifyWorkplaceType,
  matchesWorkType,
  excerpt,
  type JobCard,
} from './parse.js'

export interface SearchOpts {
  query?: string
  location: string
  jobage: number
  workType?: string
  jobType?: string
  /** Number of pages to fetch (each ~10 results). Defaults to 1. */
  pages?: number
  limit?: number
  /** Optional pino-compatible logger; defaults to silent. */
  logger?: SearchLogger
  /**
   * Explicit strict target (comma-list of remote, hybrid, onsite). Defaults to
   * `workType`, so any work-type filter is enforced against each job's listing
   * — LinkedIn's f_WT search facet leaks non-matches. Set to 'off' to disable
   * verification and keep the facet-only crawl.
   */
  strictWorkType?: string
}

/** Resolve the strict verification target: explicit override, else the facet, unless disabled. */
export function strictTarget(workType: string | undefined, strictWorkType: string | undefined): string | undefined {
  if (strictWorkType === 'off') return undefined
  return strictWorkType ?? workType
}

function buildUrl(opts: SearchOpts, page: number): string {
  const params = new URLSearchParams()
  if (opts.query) params.set('keywords', opts.query)
  if (opts.location) params.set('location', opts.location)
  const tpr = jobageToTPR(opts.jobage)
  if (tpr) params.set('f_TPR', tpr)
  const wt = workTypeFlag(opts.workType)
  if (wt) params.set('f_WT', wt)
  const jt = jobTypeFlag(opts.jobType)
  if (jt) params.set('f_JT', jt)
  params.set('start', String((page - 1) * 10))
  return `${SEARCH_URL}?${params.toString()}`
}

export interface SearchResult {
  count: number
  results: JobCard[]
}

/** LinkedIn's discrete f_TPR buckets, in days. */
export const LINKEDIN_WINDOWS = [1, 7, 30, 90, 182, 365] as const

/**
 * Pick the smallest LinkedIn search window (in days) that overlaps the given
 * anchor timestamp (e.g. the newest job's `created_at`). Returns the 14-day
 * default when there is no anchor, i.e. a first crawl.
 */
export function selectJobage(latestCreatedAt?: string | null): number {
  if (!latestCreatedAt) return 14
  const ageDays = (Date.now() - new Date(latestCreatedAt).getTime()) / 86_400_000
  const age = Math.max(0, ageDays)
  for (const window of LINKEDIN_WINDOWS) {
    if (window >= age) return window
  }
  return LINKEDIN_WINDOWS[LINKEDIN_WINDOWS.length - 1]
}

export async function search(opts: SearchOpts): Promise<SearchResult> {
  const logger = opts.logger ?? silentLogger
  const totalPages = Math.max(1, opts.pages ?? 1)
  const all: JobCard[] = []
  const startedAt = Date.now()

  for (let page = 1; page <= totalPages; page++) {
    const url = buildUrl(opts, page)
    logger.trace({ url, page }, 'search page')
    const html = await htmlFetch(url, logger)
    logger.trace({ page, url, htmlLength: html.length, htmlPreview: html.slice(0, 200) }, 'seeMoreJobPostings response')
    const cards = parseJobCards(html)
    for (const card of cards) {
      logger.debug(
        { page, providerJobId: card.id, title: card.title, company: card.company, location: card.location },
        'job card'
      )
    }
    all.push(...cards)
    // Stop early if LinkedIn returned nothing — no more results available
    if (cards.length === 0) break
  }
  logger.info({ pages: all.length, tookMs: Date.now() - startedAt }, 'search pages fetched')

  let results = all
  const target = strictTarget(opts.workType, opts.strictWorkType)
  if (target) {
    const verifyStartedAt = Date.now()
    logger.info({ target, total: all.length }, 'verifying work type')
    const kept: JobCard[] = []
    for (let i = 0; i < all.length; i++) {
      const card = all[i]
      const parsed = await detail({ id: card.id, logger })
      const classified = parsed ? classifyWorkplaceType(parsed) : null
      const match = matchesWorkType(target, classified)
      const source = parsed ? (parsed.workplaceType ? 'criteria' : classified !== null ? 'description' : null) : null
      logger.debug(
        {
          providerJobId: card.id,
          target,
          criteriaWorkplaceType: parsed?.workplaceType ?? null,
          classified,
          source,
          kept: match,
          descriptionExcerpt: excerpt(parsed?.description ?? null, 240),
        },
        'verify decision'
      )
      if (match) {
        kept.push(card)
        card.workplace = classified
      }
      if ((i + 1) % 10 === 0 || i === all.length - 1) {
        logger.trace({ verified: i + 1, kept: kept.length, total: all.length }, 'verify progress')
      }
    }
    logger.info(
      { target, kept: kept.length, total: all.length, tookMs: Date.now() - verifyStartedAt },
      'work type verified'
    )
    results = kept
  }
  if (opts.limit !== undefined && opts.limit >= 0) results = results.slice(0, opts.limit)
  return { count: results.length, results }
}
