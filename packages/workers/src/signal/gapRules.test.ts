/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Fact } from 'db'
import { describe, expect, it } from 'vitest'

import { rulesFromGapFacts } from './gapRules.js'
import { matches } from './rules.js'

function gapFact(id: number, label: string, active = true): Fact {
  return {
    id,
    category: 'gap',
    label,
    detail: null,
    evidenceType: null,
    startedAt: null,
    endedAt: null,
    period: null,
    confidence: 'inferred',
    active,
    createdAt: '2026-08-10 00:00:00',
    updatedAt: '2026-08-10 00:00:00',
  }
}

describe('rulesFromGapFacts', () => {
  it('extracts technology tokens from the label and drops stopwords', () => {
    const drafts = rulesFromGapFacts([gapFact(1, 'No professional .NET or Java experience')], [])

    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toEqual({
      ruleName: 'gap-fact-1',
      ruleCategory: 'regex_title',
      pattern: '(?i)(?:(?<!\\w)\\.net\\b|\\bjava\\b)',
      signalType: 'dealbreaker',
    })
  })

  it('keeps punctuation-led tokens like C++ and C# with non-word-char guards', () => {
    const drafts = rulesFromGapFacts([gapFact(2, 'No professional C++ or C# experience')], [])

    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.pattern).toBe('(?i)(?:\\bc\\+\\+(?!\\w)|\\bc#(?!\\w))')
  })

  it('skips gap facts whose names already exist (idempotent)', () => {
    const drafts = rulesFromGapFacts([gapFact(1, 'No professional Java experience')], ['gap-fact-1'])

    expect(drafts).toEqual([])
  })

  it('skips gap facts with no extractable tokens', () => {
    const drafts = rulesFromGapFacts([gapFact(3, 'No professional experience')], [])

    expect(drafts).toEqual([])
  })

  it('dedupes repeated tokens within one fact', () => {
    const drafts = rulesFromGapFacts([gapFact(4, 'No Java or Java experience')], [])

    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.pattern).toBe('(?i)(?:\\bjava\\b)')
  })

  it('matches plain and punctuation-led tokens against titles', () => {
    const drafts = rulesFromGapFacts([gapFact(1, 'No professional .NET or Java experience')], [])
    const pattern = drafts[0]!.pattern

    expect(matches(pattern, 'Senior .NET Developer')).toEqual(['.NET'])
    expect(matches(pattern, 'Senior Java Developer')).toEqual(['Java'])
    expect(matches(pattern, 'Frontend Engineer')).toEqual([])
  })

  it('gates C++ and C# titles', () => {
    const drafts = rulesFromGapFacts([gapFact(2, 'No professional C++ or C# experience')], [])
    const pattern = drafts[0]!.pattern

    expect(matches(pattern, 'C++ engineer')).toEqual(['C++'])
    expect(matches(pattern, 'C# Developer')).toEqual(['C#'])
    expect(matches(pattern, 'C engineer')).toEqual([])
  })

  it('does not match a token buried mid-word', () => {
    const drafts = rulesFromGapFacts([gapFact(5, 'No professional Java experience')], [])
    const pattern = drafts[0]!.pattern

    expect(matches(pattern, 'javacript engineer')).toEqual([])
    expect(matches(pattern, 'x.NET Developer')).toEqual([])
  })
})
