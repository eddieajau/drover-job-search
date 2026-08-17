/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type LogFn = (obj: unknown, msg?: string) => void

/** Minimal pino-compatible logger surface used across the provider. */
export interface SearchLogger {
  trace: LogFn
  debug: LogFn
  info: LogFn
  warn: LogFn
}

export const silentLogger: SearchLogger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
}

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string, logger: SearchLogger = silentLogger): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise(r => setTimeout(r, delay + jitter))
      logger.warn(
        { status: response.status, attempt: attempt + 1, backoffMs: delay + jitter, url },
        'request throttled'
      )
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ''
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error('Request failed after max retries')
}
