/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { normaliseWorkplace } from '../common/index.js'
import { parseSeekJob } from './parse.js'

const seekHtml = readFileSync(resolve(import.meta.dirname, '../../../../.local/examples/seek.html'), 'utf-8')

const JOB_URL = 'https://au.seek.com/job/93971606'

describe('parseSeekJob', () => {
  it('extracts all fields from a real Seek page', () => {
    const detail = parseSeekJob(seekHtml, JOB_URL)

    expect(detail).not.toBeNull()
    expect(detail!.id).toBe('93971606')
    expect(detail!.title).toBe('Senior Project Manager – Software Delivery')
    expect(detail!.company).toMatch(/MaxSoft/i)
    expect(detail!.url).toBe(JOB_URL)
    expect(detail!.location).toBe('Surfers Paradise, Gold Coast QLD')
    expect(detail!.workplaceType).toBe('remote')
    expect(detail!.employmentType).toBe('full-time')
    expect(detail!.descriptionHtml).toContain('<p>')
    expect(detail!.postedAt).toBe('2026-08-14T01:38:39.842Z')
    expect(detail!.classification).toContain('Project Management')
    expect(detail!.industry).toContain('Computer Software')
  })

  it('returns null for empty input', () => {
    expect(parseSeekJob('', JOB_URL)).toBeNull()
  })

  it('returns null for unrecognised HTML', () => {
    expect(parseSeekJob('<html><body>nothing here</body></html>', JOB_URL)).toBeNull()
  })
})

describe('employment dedup', () => {
  it('routes employmentType through the common normaliser', () => {
    // Proves the fixture's work-type is normalised via common/employment,
    // not a Seek-local map: identical input yields the canonical value.
    expect(normaliseWorkplace('Remote')).toBe('remote')
    expect(parseSeekJob(seekHtml, JOB_URL)!.employmentType).toBe('full-time')
  })
})

describe('helper dedup', () => {
  it('parse.ts sources shared helpers from ../common only', () => {
    const src = readFileSync(resolve(import.meta.dirname, 'parse.ts'), 'utf-8')

    expect(src).toContain("from '../common/index.js'")
    // No Seek-local redefinitions of the shared helpers.
    expect(src).not.toMatch(/function\s+normaliseWorkplace/)
    expect(src).not.toMatch(/function\s+htmlFetch/)
    expect(src).not.toContain('const UA')
    expect(src).not.toContain('silentLogger')
  })
})
