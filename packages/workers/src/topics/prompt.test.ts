/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Fact } from 'db'
import { describe, it, expect } from 'vitest'

import { buildPrompt } from './prompt.js'

const job = {
  title: 'Staff Engineer',
  companyName: 'Acme',
  location: 'Remote',
  description: 'TypeScript, Node.js and AWS serverless.',
}

const facts: Fact[] = [
  {
    id: 1,
    category: 'constraint',
    label: 'Open to remote; based in Australia',
    detail: null,
    evidenceType: null,
    startedAt: null,
    endedAt: null,
    period: null,
    confidence: 'stated',
    active: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 2,
    category: 'skill',
    label: 'TypeScript',
    detail: null,
    evidenceType: null,
    startedAt: null,
    endedAt: null,
    period: '10 yrs',
    confidence: 'stated',
    active: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 3,
    category: 'skill',
    label: 'Node.js',
    detail: null,
    evidenceType: null,
    startedAt: null,
    endedAt: null,
    period: '14 yrs',
    confidence: 'stated',
    active: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 4,
    category: 'role',
    label: 'Principal Full-Stack Developer @ Deckard Technologies',
    detail: null,
    evidenceType: null,
    startedAt: '2025-10',
    endedAt: null,
    period: null,
    confidence: 'stated',
    active: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 5,
    category: 'gap',
    label: 'No professional .NET or Java experience',
    detail: 'never used in a production role',
    evidenceType: null,
    startedAt: null,
    endedAt: null,
    period: null,
    confidence: 'stated',
    active: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
]

describe('buildPrompt', () => {
  it('requests gate verdicts for eligibility, language and location', () => {
    const prompt = buildPrompt(job, facts)
    expect(prompt).toContain('"gates"')
    expect(prompt).toContain('eligibility')
    expect(prompt).toContain('language')
    expect(prompt).toContain('location')
  })

  it('requests per-dimension sub-scores for all four dimensions', () => {
    const prompt = buildPrompt(job, facts)
    expect(prompt).toContain('"dimensions"')
    for (const dimension of ['technical', 'experience', 'behavioral', 'career']) {
      expect(prompt).toContain(dimension)
    }
  })

  it('documents the exact JSON output shape', () => {
    const prompt = buildPrompt(job, facts)
    expect(prompt).toContain('{"gates":')
    expect(prompt).toContain(
      '{"name": "<eligibility|language|location>", "passed": <boolean>, "score": <number>, "reason": "<string>"}'
    )
    expect(prompt).toContain('"signal_type"')
    expect(prompt).toContain('"matched_keywords"')
  })

  it('wraps job data in an untrusted-data block', () => {
    const prompt = buildPrompt(job, facts)
    expect(prompt).toContain('<job_data>')
    expect(prompt).toContain('</job_data>')
    expect(prompt).toContain('untrusted data')
  })

  it('renders the candidate profile from the seeded facts', () => {
    const prompt = buildPrompt(job, facts)
    expect(prompt).toContain('Candidate profile (derived from facts):')
    expect(prompt).toContain('- TypeScript — 10 yrs')
    expect(prompt).toContain('- Node.js — 14 yrs')
    expect(prompt).toContain('- Principal Full-Stack Developer @ Deckard Technologies (2025-10 → present)')
    expect(prompt).toContain('- Open to remote; based in Australia')
  })

  it('no longer hard-codes a location or deal-breakers', () => {
    const prompt = buildPrompt(job, facts)
    expect(prompt).not.toContain('Brisbane')
    expect(prompt).not.toContain('.NET and Java are explicit deal-breakers')
  })

  it('anchors matched_keywords to the exact fact labels and skill names', () => {
    const prompt = buildPrompt(job, facts)
    expect(prompt).toContain('prefer the exact fact labels and skill names from the profile')
  })

  it('keeps gate and dimension instructions running against an empty profile', () => {
    const prompt = buildPrompt(job, [])
    expect(prompt).toContain('No candidate profile recorded.')
    expect(prompt).toContain('"gates"')
    expect(prompt).toContain('"dimensions"')
  })
})
