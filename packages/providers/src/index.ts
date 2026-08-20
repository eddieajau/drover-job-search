/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

// Top-level barrel for the `providers` package.
//
// `importJob` is the single entry point for importing a job from any supported
// provider URL. Consumers should import everything from this barrel instead of
// reaching into `provider-linkedin` / `provider-seek` sub-paths.

import { ProviderError, silentLogger, type ProvidedJob, type SearchLogger } from './common/index.js'
import { provider as linkedinProvider } from './linkedin/index.js'
import { provider as seekProvider } from './seek/index.js'

const providers = [seekProvider, linkedinProvider]

/**
 * Detect the provider from a URL, fetch the page, and return a normalised
 * `ProvidedJob`. Throws a typed `ProviderError` when the URL is unsupported,
 * the fetch fails, or parsing fails.
 */
export async function importJob(url: string, opts?: { logger?: SearchLogger }): Promise<ProvidedJob> {
  const logger = opts?.logger ?? silentLogger

  for (const p of providers) {
    if (p.isMatch(url)) {
      return p.toJob(url, logger)
    }
  }

  throw new ProviderError('unsupported_url', 'URL must be a provider job URL')
}

export { SEEK_URL_RE } from './seek/index.js'
export { LINKEDIN_URL_RE } from './linkedin/index.js'
export {
  htmlFetch,
  normaliseEmploymentType,
  normaliseWorkplace,
  ProviderError,
  silentLogger,
  toMarkdown,
} from './common/index.js'
export type {
  EmploymentType,
  ProvidedJob,
  Provider,
  ProviderErrorCode,
  SearchLogger,
  WorkplaceType,
} from './common/index.js'
export { search, selectJobage, detail } from './linkedin/index.js'
export { parseSeekJob } from './seek/index.js'
