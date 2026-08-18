/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ProviderError } from '../common/index.js'
import { toJob } from './toJob.js'

const seekHtml = readFileSync(resolve(import.meta.dirname, '../../../../.local/examples/seek.html'), 'utf-8')

const SEEK_URL = 'https://au.seek.com/job/93971606'

describe('toJob', () => {
  it('returns a ProvidedJob with a markdown description', () => {
    const job = toJob(seekHtml, SEEK_URL)

    expect(job.provider).toBe('seek')
    expect(job.providerJobId).toBe('93971606')
    expect(job.title).toContain('Senior Project Manager')
    expect(job.url).toBe(SEEK_URL)
    expect(job.employmentType).toBe('full-time')
    expect(job.description).toBeTruthy()
    expect(job.description).not.toMatch(/<div/)
    expect(job.description).toMatch(/\*\*/)
  })

  it('throws ProviderError with parse_failed for bad HTML', () => {
    expect(() => toJob('<html>nothing', SEEK_URL)).toThrow(ProviderError)
    try {
      toJob('<html>nothing', SEEK_URL)
    } catch (e) {
      expect((e as ProviderError).code).toBe('parse_failed')
    }
  })
})
