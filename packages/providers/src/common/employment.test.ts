/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it } from 'vitest'

import { EMPLOYMENT_TYPE_MAP, normaliseEmploymentType } from './employment.js'

describe('normaliseEmploymentType', () => {
  it.each(Object.keys(EMPLOYMENT_TYPE_MAP))('maps %s to its canonical value', raw => {
    expect(normaliseEmploymentType(raw as string)).toBe(EMPLOYMENT_TYPE_MAP[raw as string])
  })

  it('maps "Full time" to "full-time"', () => {
    expect(normaliseEmploymentType('Full time')).toBe('full-time')
  })

  it('maps "internship" to "other"', () => {
    expect(normaliseEmploymentType('internship')).toBe('other')
  })

  it('returns null for an unknown value', () => {
    expect(normaliseEmploymentType('permanent')).toBeNull()
  })

  it('returns null for null', () => {
    expect(normaliseEmploymentType(null)).toBeNull()
  })
})
