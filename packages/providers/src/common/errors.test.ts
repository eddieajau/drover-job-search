/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it } from 'vitest'

import { ProviderError } from './errors.js'
import type { ProvidedJob } from './types.js'

describe('ProviderError', () => {
  it('stores the code', () => {
    const err = new ProviderError('job_closed', 'nope')
    expect(err.code).toBe('job_closed')
  })

  it('is an instance of Error', () => {
    const err = new ProviderError('fetch_failed', 'timeout')
    expect(err).toBeInstanceOf(Error)
  })

  it('has name "ProviderError"', () => {
    const err = new ProviderError('parse_failed', 'bad html')
    expect(err.name).toBe('ProviderError')
  })

  it('stores the message', () => {
    const err = new ProviderError('unsupported_url', 'bad url')
    expect(err.message).toBe('bad url')
  })
})

// Compile-time: ProvidedJob must not expose a `status` field.
;(() => {
  type NoStatus<T> = T extends { status: any } ? 'HAS_STATUS' : 'OK'
  type Check = NoStatus<ProvidedJob>
  const _ok: Check = 'OK'
  return _ok
})()
