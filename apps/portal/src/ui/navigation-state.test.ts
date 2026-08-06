/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it } from 'vitest'

import { parseHash, toHash } from './navigation-state.js'

describe('parseHash', () => {
  it('returns jobs for an empty hash', () => {
    expect(parseHash('')).toEqual({ view: 'jobs' })
  })

  it('returns jobs for the jobs hash', () => {
    expect(parseHash('#jobs')).toEqual({ view: 'jobs' })
  })

  it('returns queries for the queries hash', () => {
    expect(parseHash('#queries')).toEqual({ view: 'queries' })
  })

  it('returns signals for the signals hash', () => {
    expect(parseHash('#signals')).toEqual({ view: 'signals' })
  })

  it('returns query-edit without params for the new query hash', () => {
    expect(parseHash('#queries/edit')).toEqual({ view: 'query-edit' })
    expect(parseHash('#queries/edit?')).toEqual({ view: 'query-edit' })
  })

  it('returns query-edit with identity for the edit hash', () => {
    expect(parseHash('#queries/edit?id=3')).toEqual({ view: 'query-edit', id: 3 })
  })

  it('returns null for query-edit hashes with an invalid identity', () => {
    expect(parseHash('#queries/edit?id=abc')).toBeNull()
    expect(parseHash('#queries/edit?id=0')).toBeNull()
    expect(parseHash('#queries/edit?id=-2')).toBeNull()
  })

  it('returns null for unknown hashes', () => {
    expect(parseHash('#bogus')).toBeNull()
  })

  it('returns jobs without job for hashes with unknown query params', () => {
    expect(parseHash('#jobs?x=1')).toEqual({ view: 'jobs' })
  })

  it('returns jobs with job identity for the jobs hash with a valid job param', () => {
    expect(parseHash('#jobs?job=42')).toEqual({ view: 'jobs', job: 42 })
  })

  it('returns jobs without job for non-numeric or non-positive job params', () => {
    expect(parseHash('#jobs?job=abc')).toEqual({ view: 'jobs' })
    expect(parseHash('#jobs?job=-5')).toEqual({ view: 'jobs' })
    expect(parseHash('#jobs?job=0')).toEqual({ view: 'jobs' })
  })
})

describe('toHash', () => {
  it('round-trips the view states', () => {
    expect(toHash({ view: 'jobs' })).toBe('#jobs')
    expect(toHash({ view: 'jobs', job: 42 })).toBe('#jobs?job=42')
    expect(toHash({ view: 'queries' })).toBe('#queries')
    expect(toHash({ view: 'signals' })).toBe('#signals')
    expect(toHash({ view: 'query-edit' })).toBe('#queries/edit')
    expect(toHash({ view: 'query-edit', id: 3 })).toBe('#queries/edit?id=3')
  })
})
