/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export type ProviderErrorCode = 'unsupported_url' | 'fetch_failed' | 'parse_failed' | 'job_closed'

/**
 * Typed error thrown by provider adapters.
 *
 * The handler maps `code` to an HTTP status via the table in the ticket spec.
 *
 * | `ProviderErrorCode` | HTTP | message                                        |
 * |---------------------|------|------------------------------------------------|
 * | `unsupported_url`   | 400  | `URL must be a provider job URL`               |
 * | `fetch_failed`      | 422  | `Could not fetch job page`                     |
 * | `parse_failed`      | 422  | `Could not parse job page`                     |
 * | `job_closed`        | 422  | `This job is no longer accepting applications` |
 */
export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
