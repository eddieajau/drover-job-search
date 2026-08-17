/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it } from 'vitest'

import { normaliseWorkplace } from './workplace.js'

describe('normaliseWorkplace', () => {
  it('maps "Remote" to "remote"', () => {
    expect(normaliseWorkplace('Remote')).toBe('remote')
  })

  it('maps "On-site" to "onsite"', () => {
    expect(normaliseWorkplace('On-site')).toBe('onsite')
  })

  it('returns null for null', () => {
    expect(normaliseWorkplace(null)).toBeNull()
  })
})
