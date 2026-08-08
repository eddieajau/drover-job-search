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

  it('returns queues for the queues hash', () => {
    expect(parseHash('#queues')).toEqual({ view: 'queues' })
  })

  it('returns facts for the facts hash', () => {
    expect(parseHash('#facts')).toEqual({ view: 'facts' })
  })

  it('returns fact-edit without params for the new fact hash', () => {
    expect(parseHash('#facts/edit')).toEqual({ view: 'fact-edit' })
    expect(parseHash('#facts/edit?')).toEqual({ view: 'fact-edit' })
  })

  it('returns fact-edit with identity for the edit hash', () => {
    expect(parseHash('#facts/edit?id=5')).toEqual({ view: 'fact-edit', id: 5 })
  })

  it('returns null for fact-edit hashes with an invalid identity', () => {
    expect(parseHash('#facts/edit?id=abc')).toBeNull()
    expect(parseHash('#facts/edit?id=0')).toBeNull()
    expect(parseHash('#facts/edit?id=-2')).toBeNull()
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

  it('parses filter params into filters on the jobs view', () => {
    expect(parseHash('#jobs?job=3&priority=1&status=applied&score=hot&q=go')).toEqual({
      view: 'jobs',
      job: 3,
      filters: { priority: '1', status: 'applied', search: 'go', score: 'hot' },
    })
  })

  it('keeps filters absent when no filter params are present', () => {
    expect(parseHash('#jobs?job=3')).toEqual({ view: 'jobs', job: 3 })
  })

  it('parses the documented round-trip example', () => {
    expect(parseHash('#jobs?job=3&priority=1&score=hot&q=go')).toEqual({
      view: 'jobs',
      job: 3,
      filters: { priority: '1', status: '', search: 'go', score: 'hot' },
    })
  })

  it('parses filters without a job identity', () => {
    expect(parseHash('#jobs?score=neutral')).toEqual({
      view: 'jobs',
      filters: { priority: '', status: '', search: '', score: 'neutral' },
    })
  })
})

describe('toHash', () => {
  it('round-trips the view states', () => {
    expect(toHash({ view: 'jobs' })).toBe('#jobs')
    expect(toHash({ view: 'jobs', job: 42 })).toBe('#jobs?job=42')
    expect(toHash({ view: 'queries' })).toBe('#queries')
    expect(toHash({ view: 'signals' })).toBe('#signals')
    expect(toHash({ view: 'queues' })).toBe('#queues')
    expect(toHash({ view: 'facts' })).toBe('#facts')
    expect(toHash({ view: 'query-edit' })).toBe('#queries/edit')
    expect(toHash({ view: 'query-edit', id: 3 })).toBe('#queries/edit?id=3')
    expect(toHash({ view: 'fact-edit' })).toBe('#facts/edit')
    expect(toHash({ view: 'fact-edit', id: 5 })).toBe('#facts/edit?id=5')
  })

  it('round-trips the jobs filters into the query string', () => {
    expect(
      toHash({
        view: 'jobs',
        job: 3,
        filters: { priority: '1', status: '', search: 'go', score: 'hot' },
      })
    ).toBe('#jobs?job=3&priority=1&score=hot&q=go')
  })

  it('omits empty filter params so the URL stays clean', () => {
    expect(
      toHash({
        view: 'jobs',
        job: 3,
        filters: { priority: '1', status: '', search: '', score: '' },
      })
    ).toBe('#jobs?job=3&priority=1')
  })
})
