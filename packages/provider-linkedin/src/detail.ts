// Adapted from linkedin-search-cli (MIT License).
// Original: https://github.com/MadsLorentzen/ai-job-search/tree/main/.agents/skills/linkedin-search/cli

import { DETAIL_URL, htmlFetch, parseJobDetail, silentLogger, type SearchLogger, type JobDetail } from './helpers.js'

export interface DetailOpts {
  id: string
  logger?: SearchLogger
}

/** Accept a raw job ID, a job-view URL, or a job URN. */
function normalizeId(input: string): string | null {
  const urn = input.match(/urn:li:jobPosting:(\d+)/)
  if (urn) return urn[1]
  const url = input.match(/-(\d{6,})(?:[/?]|$)/) || input.match(/\/(\d{6,})(?:[/?]|$)/)
  if (url) return url[1]
  const bare = input.match(/^\d{6,}$/)
  if (bare) return input
  return null
}

export async function detail(opts: DetailOpts): Promise<JobDetail | null> {
  const id = normalizeId(opts.id)
  if (!id) throw new Error(`Could not parse a job ID from "${opts.id}"`)

  const html = await htmlFetch(`${DETAIL_URL}/${id}`, opts.logger ?? silentLogger)
  if (!html) return null
  return parseJobDetail(html, id)
}
