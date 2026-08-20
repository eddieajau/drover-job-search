/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it } from 'vitest'

import { provider, SEEK_URL_RE } from './index.js'

const VALID_SEEK_URL = 'https://au.seek.com/job/93971606'
const SEEK_URL_WITH_SUFFIX = 'https://au.seek.com/job/93971606/details'
const NON_SEEK_URL = 'https://example.com/job/123'

describe('SEEK_URL_RE', () => {
  it('matches a valid SEEK job URL', () => {
    expect(SEEK_URL_RE.test(VALID_SEEK_URL)).toBe(true)
  })

  it('rejects a SEEK URL with a path suffix', () => {
    expect(SEEK_URL_RE.test(SEEK_URL_WITH_SUFFIX)).toBe(false)
  })

  it('rejects a non-SEEK URL', () => {
    expect(SEEK_URL_RE.test(NON_SEEK_URL)).toBe(false)
  })

  it('extracts the numeric job ID from a match', () => {
    const match = VALID_SEEK_URL.match(SEEK_URL_RE)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('93971606')
  })
})

describe('provider.isMatch', () => {
  it('returns true for a valid SEEK URL', () => {
    expect(provider.isMatch(VALID_SEEK_URL)).toBe(true)
  })

  it('returns false for a SEEK URL with a path suffix', () => {
    expect(provider.isMatch(SEEK_URL_WITH_SUFFIX)).toBe(false)
  })

  it('returns false for a non-SEEK URL', () => {
    expect(provider.isMatch(NON_SEEK_URL)).toBe(false)
  })
})
