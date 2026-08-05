import { describe, expect, it } from 'vitest'

import { selectJobage } from './search.js'

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
