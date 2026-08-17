import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { normaliseWorkplace, parseSeekJob } from './helpers.js'

const seekHtml = readFileSync(resolve(import.meta.dirname, '../../../.local/examples/seek.html'), 'utf-8')

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

describe('normaliseWorkplace', () => {
  it('maps Seek labels to canonical types', () => {
    expect(normaliseWorkplace('Remote')).toBe('remote')
    expect(normaliseWorkplace('Hybrid')).toBe('hybrid')
    expect(normaliseWorkplace('On-site')).toBe('onsite')
  })

  it('returns null for null or unrecognised labels', () => {
    expect(normaliseWorkplace(null)).toBeNull()
    expect(normaliseWorkplace('  ')).toBeNull()
  })
})
