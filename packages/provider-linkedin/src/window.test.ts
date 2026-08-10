import { describe, expect, it } from 'vitest'

import { selectJobage, strictTarget } from './search.js'

const DAY = 86_400_000

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString()
}

describe('selectJobage', () => {
  it('defaults to 14 days when there is no anchor', () => {
    expect(selectJobage(undefined)).toBe(14)
    expect(selectJobage(null)).toBe(14)
    expect(selectJobage('')).toBe(14)
  })

  it('picks the smallest bucket overlapping the anchor age', () => {
    expect(selectJobage(isoDaysAgo(0.5))).toBe(1)
    expect(selectJobage(isoDaysAgo(1))).toBe(1)
    expect(selectJobage(isoDaysAgo(3))).toBe(7)
    expect(selectJobage(isoDaysAgo(7))).toBe(7)
    expect(selectJobage(isoDaysAgo(25))).toBe(30)
    expect(selectJobage(isoDaysAgo(100))).toBe(182)
    expect(selectJobage(isoDaysAgo(200))).toBe(365)
  })

  it('clamps to the largest bucket beyond LinkedIn coverage', () => {
    expect(selectJobage(isoDaysAgo(400))).toBe(365)
    expect(selectJobage(isoDaysAgo(1000))).toBe(365)
  })

  it('clamps negative age (future anchor) to the smallest bucket', () => {
    expect(selectJobage(new Date(Date.now() + 5 * DAY).toISOString())).toBe(1)
  })
})

describe('strictTarget', () => {
  it('defaults to the work-type facet (implicit strict)', () => {
    expect(strictTarget('remote', undefined)).toBe('remote')
    expect(strictTarget('remote,hybrid', undefined)).toBe('remote,hybrid')
  })

  it('prefers an explicit strict override', () => {
    expect(strictTarget('remote', 'remote,hybrid')).toBe('remote,hybrid')
  })

  it('disables verification with "off"', () => {
    expect(strictTarget('remote', 'off')).toBeUndefined()
    expect(strictTarget(undefined, 'off')).toBeUndefined()
  })

  it('returns undefined when no work type is set', () => {
    expect(strictTarget(undefined, undefined)).toBeUndefined()
  })
})
