/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it } from 'vitest'

import { relativeAge } from './posted-age.js'

const now = new Date('2026-08-07T12:00:00Z')

describe('relativeAge', () => {
  it('returns an empty string for null or invalid input', () => {
    expect(relativeAge(null, now)).toBe('')
    expect(relativeAge('not-a-date', now)).toBe('')
    expect(relativeAge('', now)).toBe('')
  })

  it('returns "today" for the same day', () => {
    expect(relativeAge('2026-08-07', now)).toBe('today')
  })

  it('returns "yesterday" for one day ago', () => {
    expect(relativeAge('2026-08-06', now)).toBe('yesterday')
  })

  it('returns "Nd" for multiple days', () => {
    expect(relativeAge('2026-08-04', now)).toBe('3d')
    expect(relativeAge('2026-08-01', now)).toBe('6d')
  })

  it('returns "today" for future-dated postings (clock skew)', () => {
    expect(relativeAge('2026-08-08', now)).toBe('today')
  })
})
