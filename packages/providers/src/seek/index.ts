/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export { parseSeekJob, type SeekJobDetail } from './parse.js'

/**
 * Placeholder for the Seek `toJob` adapter. Filled in by ticket 130, which
 * turns parsed HTML into a `ProvidedJob` with a markdown description.
 * Not wired anywhere yet.
 */
export function toJob(): never {
  throw new Error('providers/seek toJob not implemented yet (ticket 130)')
}
