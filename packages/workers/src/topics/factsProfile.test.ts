/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Fact } from 'db'
import { describe, expect, it } from 'vitest'

import { buildFactsProfile } from './factsProfile.js'

function fact(overrides: Partial<Fact>): Fact {
  return {
    id: 1,
    category: 'skill',
    label: 'TypeScript',
    detail: null,
    evidenceType: null,
    startedAt: null,
    endedAt: null,
    period: null,
    confidence: 'stated',
    active: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  }
}

describe('buildFactsProfile', () => {
  it('groups facts by category in the fixed order', () => {
    const profile = buildFactsProfile([
      fact({ id: 1, category: 'credential', label: 'Bachelor of Engineering' }),
      fact({ id: 2, category: 'skill', label: 'TypeScript' }),
      fact({ id: 3, category: 'constraint', label: 'Open to remote' }),
    ])

    expect(profile).toContain('Candidate profile (derived from facts):')
    const constraint = profile.indexOf('## Constraints')
    const skill = profile.indexOf('## Skills')
    const credential = profile.indexOf('## Credentials')
    expect(constraint).toBeGreaterThan(-1)
    expect(skill).toBeGreaterThan(constraint)
    expect(credential).toBeGreaterThan(skill)
    expect(profile).toContain('- Open to remote')
    expect(profile).toContain('- TypeScript')
    expect(profile).toContain('- Bachelor of Engineering')
  })

  it('asserts stated facts without a prefix', () => {
    const profile = buildFactsProfile([fact({ category: 'skill', label: 'TypeScript', confidence: 'stated' })])
    expect(profile).toContain('- TypeScript')
    expect(profile).not.toContain('(inferred from resume)')
  })

  it('prefixes inferred facts with the inferred-from-resume note', () => {
    const profile = buildFactsProfile([fact({ category: 'skill', label: 'Kafka', confidence: 'inferred' })])
    expect(profile).toContain('- (inferred from resume) Kafka')
  })

  it('excludes stretch facts from the rubric entirely', () => {
    const profile = buildFactsProfile([
      fact({ category: 'skill', label: 'TypeScript', confidence: 'stated' }),
      fact({ id: 2, category: 'skill', label: 'COBOL', confidence: 'stretch' }),
    ])
    expect(profile).toContain('- TypeScript')
    expect(profile).not.toContain('COBOL')
  })

  it('renders the period as a compact suffix', () => {
    const profile = buildFactsProfile([fact({ category: 'skill', label: 'TypeScript', period: '10 yrs' })])
    expect(profile).toContain('- TypeScript — 10 yrs')
  })

  it('renders started and ended dates as a range', () => {
    const profile = buildFactsProfile([
      fact({
        category: 'role',
        label: 'Senior Software Engineer @ Cooltrax',
        startedAt: '2024-03',
        endedAt: '2025-10',
      }),
    ])
    expect(profile).toContain('- Senior Software Engineer @ Cooltrax (2024-03 → 2025-10)')
  })

  it('renders a lone started date as open-ended', () => {
    const profile = buildFactsProfile([
      fact({ category: 'role', label: 'Senior Software Engineer @ Cooltrax', startedAt: '2024-03' }),
    ])
    expect(profile).toContain('- Senior Software Engineer @ Cooltrax (2024-03 → present)')
  })

  it('renders the detail after the label', () => {
    const profile = buildFactsProfile([
      fact({
        category: 'gap',
        label: 'No professional .NET or Java experience',
        detail: 'never used in a production role',
      }),
    ])
    expect(profile).toContain('- No professional .NET or Java experience — never used in a production role')
  })

  it('renders a short block when there are no facts', () => {
    const profile = buildFactsProfile([])
    expect(profile).toBe('Candidate profile (derived from facts):\nNo candidate profile recorded.')
  })

  it('renders the no-profile block when every fact is stretch or inactive', () => {
    const profile = buildFactsProfile([
      fact({ category: 'skill', label: 'COBOL', confidence: 'stretch', active: false }),
    ])
    expect(profile).toContain('No candidate profile recorded.')
  })
})
