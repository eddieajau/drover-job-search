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

  it('returns fact-ingest for the facts/ingest hash', () => {
    expect(parseHash('#facts/ingest')).toEqual({ view: 'fact-ingest' })
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

  it('ignores a stray priority param without crashing', () => {
    expect(parseHash('#jobs?job=3&priority=1')).toEqual({ view: 'jobs', job: 3 })
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
    expect(parseHash('#jobs?job=3&status=applied&q=go')).toEqual({
      view: 'jobs',
      job: 3,
      filters: { status: 'applied', search: 'go', sort: 'score' },
    })
  })

  it('keeps filters absent when no filter params are present', () => {
    expect(parseHash('#jobs?job=3')).toEqual({ view: 'jobs', job: 3 })
  })

  it('parses the documented round-trip example', () => {
    expect(parseHash('#jobs?job=3&q=go')).toEqual({
      view: 'jobs',
      job: 3,
      filters: { status: 'new', search: 'go', sort: 'score' },
    })
  })

  it('parses filters without a job identity', () => {
    expect(parseHash('#jobs?status=discovered')).toEqual({
      view: 'jobs',
      filters: { status: 'discovered', search: '', sort: 'score' },
    })
  })

  it('parses a status=new param into the default status', () => {
    expect(parseHash('#jobs?status=new')).toEqual({
      view: 'jobs',
      filters: { status: 'new', search: '', sort: 'score' },
    })
  })

  it('returns the default status for absent status keys', () => {
    expect(parseHash('#jobs?q=go')).toEqual({
      view: 'jobs',
      filters: { status: 'new', search: 'go', sort: 'score' },
    })
  })

  it('ignores score params entirely', () => {
    expect(parseHash('#jobs?score=hot')).toEqual({ view: 'jobs' })
    expect(parseHash('#jobs?status=applied&score=hot')).toEqual({
      view: 'jobs',
      filters: { status: 'applied', search: '', sort: 'score' },
    })
  })

  it('parses sort from the query string', () => {
    expect(parseHash('#jobs?sort=posted')).toEqual({
      view: 'jobs',
      filters: { status: 'new', search: '', sort: 'posted' },
    })
  })

  it('defaults sort to score when sort param is absent but other filters exist', () => {
    expect(parseHash('#jobs?status=discovered')).toEqual({
      view: 'jobs',
      filters: { status: 'discovered', search: '', sort: 'score' },
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
    expect(toHash({ view: 'fact-ingest' })).toBe('#facts/ingest')
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
        filters: { status: 'discovered', search: 'go', sort: 'score' },
      })
    ).toBe('#jobs?job=3&status=discovered&q=go')
  })

  it('omits empty filter params so the URL stays clean', () => {
    expect(
      toHash({
        view: 'jobs',
        job: 3,
        filters: { status: 'new', search: '', sort: 'score' },
      })
    ).toBe('#jobs?job=3')
  })

  it('omits the default status from the URL', () => {
    expect(
      toHash({
        view: 'jobs',
        filters: { status: 'new', search: '', sort: 'score' },
      })
    ).toBe('#jobs')
  })

  it('includes non-default filters in the URL', () => {
    expect(
      toHash({
        view: 'jobs',
        filters: { status: 'discovered', search: '', sort: 'posted' },
      })
    ).toBe('#jobs?status=discovered&sort=posted')
  })

  it('omits sort when it is the default score', () => {
    expect(
      toHash({
        view: 'jobs',
        filters: { status: 'new', search: '', sort: 'score' },
      })
    ).toBe('#jobs')
  })

  it('includes sort in the URL when non-default', () => {
    expect(
      toHash({
        view: 'jobs',
        filters: { status: 'new', search: '', sort: 'posted' },
      })
    ).toBe('#jobs?sort=posted')
  })

  it('round-trips sort through parseHash and toHash', () => {
    expect(
      toHash({
        view: 'jobs',
        filters: { status: 'new', search: '', sort: 'company' },
      })
    ).toBe('#jobs?sort=company')
    expect(parseHash('#jobs?sort=company')).toEqual({
      view: 'jobs',
      filters: { status: 'new', search: '', sort: 'company' },
    })
  })

  it('round-trips a non-default status through parseHash and toHash', () => {
    expect(
      toHash({
        view: 'jobs',
        filters: { status: 'discovered', search: '', sort: 'score' },
      })
    ).toBe('#jobs?status=discovered')
    expect(parseHash('#jobs?status=discovered')).toEqual({
      view: 'jobs',
      filters: { status: 'discovered', search: '', sort: 'score' },
    })
  })
})
