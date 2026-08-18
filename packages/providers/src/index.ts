/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

// Top-level barrel for the `providers` package.
//
// `importJob` is the single entry point for importing a job from any supported
// provider URL. Consumers should import everything from this barrel instead of
// reaching into `provider-linkedin` / `provider-seek` sub-paths.

import { htmlFetch, ProviderError, silentLogger, type ProvidedJob, type SearchLogger } from './common/index.js'
import { toJob as linkedinToJob } from './linkedin/toJob.js'
import { toJob as seekToJob } from './seek/toJob.js'

const SEEK_URL_RE = /^https?:\/\/au\.seek\.com\/job\/(\d+)$/
const LINKEDIN_URL_RE = /^https?:\/\/(?:[a-z]{2,}\.)?linkedin\.com\/jobs\/view\/(\d{6,})\/?$/

/**
 * Detect the provider from a URL, fetch the page, and return a normalised
 * `ProvidedJob`. Throws a typed `ProviderError` when the URL is unsupported,
 * the fetch fails, or parsing fails.
 */
export async function importJob(url: string, opts?: { logger?: SearchLogger }): Promise<ProvidedJob> {
  const logger = opts?.logger ?? silentLogger

  const seekMatch = url.match(SEEK_URL_RE)
  if (seekMatch) {
    const html = await htmlFetch(url, logger)
    if (!html) {
      throw new ProviderError('fetch_failed', 'Could not fetch job page')
    }
    return seekToJob(html, url)
  }

  const linkedinMatch = url.match(LINKEDIN_URL_RE)
  if (linkedinMatch) {
    return linkedinToJob(linkedinMatch[1], logger)
  }

  throw new ProviderError('unsupported_url', 'URL must be a provider job URL')
}

export { SEEK_URL_RE, LINKEDIN_URL_RE }
export {
  htmlFetch,
  normaliseEmploymentType,
  normaliseWorkplace,
  ProviderError,
  silentLogger,
  toMarkdown,
} from './common/index.js'
export type { EmploymentType, ProvidedJob, ProviderErrorCode, SearchLogger, WorkplaceType } from './common/index.js'
export { search, selectJobage, detail } from './linkedin/index.js'
export { parseSeekJob } from './seek/index.js'
