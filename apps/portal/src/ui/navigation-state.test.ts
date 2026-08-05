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
    expect(parseHash('#jobs?x=1')).toBeNull()
  })
})

describe('toHash', () => {
  it('round-trips the view states', () => {
    expect(toHash({ view: 'jobs' })).toBe('#jobs')
    expect(toHash({ view: 'queries' })).toBe('#queries')
    expect(toHash({ view: 'query-edit' })).toBe('#queries/edit')
    expect(toHash({ view: 'query-edit', id: 3 })).toBe('#queries/edit?id=3')
  })
})
