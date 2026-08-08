/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, it, expect } from 'vitest'

import { buildPrompt } from './prompt.js'

const job = {
  title: 'Staff Engineer',
  companyName: 'Acme',
  location: 'Remote',
  description: 'TypeScript, Node.js and AWS serverless.',
}

describe('buildPrompt', () => {
  it('requests gate verdicts for eligibility, language and location', () => {
    const prompt = buildPrompt(job)
    expect(prompt).toContain('"gates"')
    expect(prompt).toContain('eligibility')
    expect(prompt).toContain('language')
    expect(prompt).toContain('location')
  })

  it('requests per-dimension sub-scores for all four dimensions', () => {
    const prompt = buildPrompt(job)
    expect(prompt).toContain('"dimensions"')
    for (const dimension of ['technical', 'experience', 'behavioral', 'career']) {
      expect(prompt).toContain(dimension)
    }
  })

  it('documents the exact JSON output shape', () => {
    const prompt = buildPrompt(job)
    expect(prompt).toContain('{"gates":')
    expect(prompt).toContain(
      '{"name": "<eligibility|language|location>", "passed": <boolean>, "score": <number>, "reason": "<string>"}'
    )
    expect(prompt).toContain('"signal_type"')
    expect(prompt).toContain('"matched_keywords"')
  })

  it('wraps job data in an untrusted-data block', () => {
    const prompt = buildPrompt(job)
    expect(prompt).toContain('<job_data>')
    expect(prompt).toContain('</job_data>')
    expect(prompt).toContain('untrusted data')
  })
})
