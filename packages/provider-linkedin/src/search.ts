// Adapted from linkedin-search-cli (MIT License).
// Original: https://github.com/MadsLorentzen/ai-job-search/tree/main/.agents/skills/linkedin-search/cli

import {
  SEARCH_URL,
  htmlFetch,
  parseJobCards,
  jobageToTPR,
  workTypeFlag,
  jobTypeFlag,
  type JobCard,
} from './helpers.js'

export interface SearchOpts {
  query?: string
  location: string
  jobage: number
  workType?: string
  jobType?: string
  /** Number of pages to fetch (each ~10 results). Defaults to 1. */
  pages?: number
  limit?: number
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

export async function search(opts: SearchOpts): Promise<SearchResult> {
  const totalPages = Math.max(1, opts.pages ?? 1)
  const all: JobCard[] = []

  for (let page = 1; page <= totalPages; page++) {
    console.log('buildUrl', buildUrl(opts, page))
    const html = await htmlFetch(buildUrl(opts, page))
    const cards = parseJobCards(html)
    all.push(...cards)
    // Stop early if LinkedIn returned nothing — no more results available
    if (cards.length === 0) break
  }

  let results = all
  if (opts.limit !== undefined && opts.limit >= 0) results = results.slice(0, opts.limit)
  return { count: results.length, results }
}
