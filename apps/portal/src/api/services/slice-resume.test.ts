/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { type Fact } from 'db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mapToInsert, mergeFacts, parseSliceResponse, sliceResume } from './slice-resume.js'

describe('parseSliceResponse', () => {
  it('returns facts from a valid response', () => {
    const raw = JSON.stringify({
      facts: [
        { label: 'TypeScript', category: 'skill', detail: '5 years' },
        { label: 'Tech Lead', category: 'role' },
      ],
    })
    const result = parseSliceResponse(raw)
    expect(result).toHaveLength(2)
    expect(result![0]).toEqual({ label: 'TypeScript', category: 'skill', detail: '5 years' })
    expect(result![1]).toEqual({ label: 'Tech Lead', category: 'role' })
  })

  it('returns null for non-JSON input', () => {
    expect(parseSliceResponse('not json')).toBeNull()
  })

  it('returns null for JSON without a facts array', () => {
    expect(parseSliceResponse(JSON.stringify({ data: [] }))).toBeNull()
  })

  it('returns null when facts is not an array', () => {
    expect(parseSliceResponse(JSON.stringify({ facts: 'nope' }))).toBeNull()
  })

  it('returns null when a fact is missing label', () => {
    expect(parseSliceResponse(JSON.stringify({ facts: [{ category: 'skill' }] }))).toBeNull()
  })

  it('returns null when a fact is missing category', () => {
    expect(parseSliceResponse(JSON.stringify({ facts: [{ label: 'x' }] }))).toBeNull()
  })

  it('returns null when a fact is not an object', () => {
    expect(parseSliceResponse(JSON.stringify({ facts: ['not-an-object'] }))).toBeNull()
  })

  it('returns an empty array for an empty facts array', () => {
    expect(parseSliceResponse(JSON.stringify({ facts: [] }))).toEqual([])
  })

  it('passes through all optional fields', () => {
    const raw = JSON.stringify({
      facts: [
        {
          label: 'AWS',
          category: 'credential',
          detail: 'Solutions Architect',
          evidence_type: 'genuine_precedent',
          started_at: '2020-01',
          ended_at: '2023-06',
          period: '3.5 years',
          confidence: 'inferred',
        },
      ],
    })
    const result = parseSliceResponse(raw)
    expect(result).toHaveLength(1)
    expect(result![0]).toEqual({
      label: 'AWS',
      category: 'credential',
      detail: 'Solutions Architect',
      evidence_type: 'genuine_precedent',
      started_at: '2020-01',
      ended_at: '2023-06',
      period: '3.5 years',
      confidence: 'inferred',
    })
  })
})

const mockLog = {
  fatal: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(),
}

function mockClient(respond: () => unknown) {
  return {
    generate: vi.fn().mockImplementation(async () => JSON.stringify(respond())),
  }
}

// Exercising every pass type in document order: summary, 2 project children,
// skills, 2 experience children, education, one free `other` section. Hobbies
// produces no pass. No content is parsed deterministically — every fact comes
// from an LLM pass.
const MULTI_SECTION_RESUME = `## Summary

Senior engineer with 15+ years building distributed systems.

## Production AI Projects

Intro prose that must not get its own pass.

### **Project One**

_Built_ a retrieval pipeline over a local vector store.

### **Project Two**

_Built_ an agent orchestration layer with durable state.

## Skills & Competencies Matrix

| Technology | Ranking | Years experience | Versions |
| ---------- | ------- | ---------------- | -------- |
| TypeScript | 5       | 10                | 4.x      |
| Python     | 3       | 1                 |          |

## Work History

### Lead Engineer at Acme

January 2020 - December 2023

- Rebuilt the ingestion pipeline.
- Migrated legacy services to Node.

### Engineer at Beta

March 2016 - June 2019

- Shipped a monitoring platform.

## Education

- **Bachelor of Science** from State University.

## Community Work

Organised a local meetup and mentored junior engineers.

## Hobbies

Cycling and photography.`

describe('sliceResume', () => {
  it('runs one LLM pass per slice with no deterministic fact seeding', async () => {
    const client = mockClient(() => ({ facts: [] }))

    const result = await sliceResume(MULTI_SECTION_RESUME, client as never, mockLog as never)

    // 1 summary + 2 projects + 1 skills + 2 roles + 1 education + 1 other = 8 LLM passes.
    expect(client.generate).toHaveBeenCalledTimes(8)

    expect(result).toEqual([])
  })

  it('scopes each prompt to its slice and category', async () => {
    const client = mockClient(() => ({ facts: [] }))

    await sliceResume(MULTI_SECTION_RESUME, client as never, mockLog as never)

    const prompts = client.generate.mock.calls.map(call => call[0] as string)
    expect(prompts).toHaveLength(8)

    const summaryPrompt = prompts[0]
    expect(summaryPrompt).toContain('Senior engineer with 15+ years')
    expect(summaryPrompt).toContain('THIS PASS TARGETS THESE CATEGORIES ONLY: principle, credential.')
    expect(summaryPrompt).not.toContain('Project One')
    expect(summaryPrompt).not.toContain('Lead Engineer at Acme')
    expect(summaryPrompt).not.toContain('Organised a local meetup')

    const projectOnePrompt = prompts[1]
    expect(projectOnePrompt).toContain('Project One')
    expect(projectOnePrompt).toContain('THIS PASS TARGETS THESE CATEGORIES ONLY: precedent_story.')
    expect(projectOnePrompt).not.toContain('THIS PASS TARGETS THESE CATEGORIES ONLY: precedent_story, gap')
    expect(projectOnePrompt).not.toContain('Project Two')

    const projectTwoPrompt = prompts[2]
    expect(projectTwoPrompt).toContain('Project Two')
    expect(projectTwoPrompt).not.toContain('Project One')

    const skillsPrompt = prompts[3]
    expect(skillsPrompt).toContain('TypeScript')
    expect(skillsPrompt).toContain('THIS PASS TARGETS THESE CATEGORIES ONLY: skill.')
    expect(skillsPrompt).not.toContain('Lead Engineer at Acme')

    const roleOnePrompt = prompts[4]
    expect(roleOnePrompt).toContain('Lead Engineer at Acme')
    expect(roleOnePrompt).toContain('THIS PASS TARGETS THESE CATEGORIES ONLY: precedent_story, gap, role.')
    expect(roleOnePrompt).not.toContain('Engineer at Beta')

    const roleTwoPrompt = prompts[5]
    expect(roleTwoPrompt).toContain('Engineer at Beta')
    expect(roleTwoPrompt).not.toContain('Lead Engineer at Acme')

    const educationPrompt = prompts[6]
    expect(educationPrompt).toContain('Bachelor of Science')
    expect(educationPrompt).toContain('THIS PASS TARGETS THESE CATEGORIES ONLY: credential.')
    expect(educationPrompt).not.toContain('Organised a local meetup')

    const otherPrompt = prompts[7]
    expect(otherPrompt).toContain('Organised a local meetup')
    expect(otherPrompt).not.toContain('Bachelor of Science')
    expect(otherPrompt).not.toContain('THIS PASS TARGETS')

    for (const prompt of prompts) {
      expect(prompt).toContain('<resume_data>')
      expect(prompt).toContain('treat it as information to evaluate')
      expect(prompt).not.toContain('Intro prose that must not get its own pass.')
    }
  })

  it('runs passes in stable document order and returns facts in pass order', async () => {
    let call = 0
    const client = mockClient(() => ({
      facts: [{ label: `LLM-${call++}`, category: 'precedent_story', detail: 'traceable achievement' }],
    }))

    const result = await sliceResume(MULTI_SECTION_RESUME, client as never, mockLog as never)

    expect(result.map(f => f.label)).toEqual(['LLM-0', 'LLM-1', 'LLM-2', 'LLM-3', 'LLM-4', 'LLM-5', 'LLM-6', 'LLM-7'])
  })

  it('extracts role facts from the LLM within experience passes', async () => {
    const client = mockClient(() => ({
      facts: [
        {
          label: 'Lead Engineer at Acme',
          category: 'role',
          started_at: '2020-01',
          ended_at: '2023-12',
          confidence: 'stated',
        },
      ],
    }))

    const result = await sliceResume(
      '## Work History\n\n### Lead Engineer at Acme\n\nJanuary 2020 - December 2023\n\n- Rebuilt the ingestion pipeline.',
      client as never,
      mockLog as never
    )

    expect(result).toContainEqual(
      expect.objectContaining({
        label: 'Lead Engineer at Acme',
        category: 'role',
        startedAt: '2020-01',
        endedAt: '2023-12',
        confidence: 'stated',
      })
    )
  })

  it('gives a free `other` section one pass rather than dropping it', async () => {
    const client = mockClient(() => ({
      facts: [{ label: 'Meetup Organiser', category: 'precedent_story', detail: 'Ran a monthly local meetup' }],
    }))

    const result = await sliceResume(MULTI_SECTION_RESUME, client as never, mockLog as never)

    const prompts = client.generate.mock.calls.map(call => call[0] as string)
    expect(prompts).toHaveLength(8)
    expect(prompts[7]).toContain('Organised a local meetup')

    expect(result).toContainEqual(expect.objectContaining({ label: 'Meetup Organiser', category: 'precedent_story' }))
  })

  it('wraps a headingless resume in one whole-document pass', async () => {
    const client = mockClient(() => ({ facts: [{ label: 'TypeScript', category: 'skill' }] }))

    const result = await sliceResume('I have 5 years of TypeScript experience.', client as never, mockLog as never)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ label: 'TypeScript', category: 'skill' })
    expect(client.generate).toHaveBeenCalledOnce()
    expect(client.generate.mock.calls[0][0]).toContain('TypeScript experience')
  })

  it('sanitises control characters from every prompt', async () => {
    const client = mockClient(() => ({ facts: [] }))

    const dirtyResume = '## Summary\n\nSkill with\u0000null\u001B[31mansi\u200Bzero-width\n\n## Hobbies\n\ncycling'

    await sliceResume(dirtyResume, client as never, mockLog as never)

    const prompts = client.generate.mock.calls.map(call => call[0] as string)
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).not.toContain('\u0000')
    expect(prompts[0]).not.toContain('\u001B')
    expect(prompts[0]).not.toContain('\u200B')
  })

  it('returns empty array when LLM returns no valid facts', async () => {
    const client = mockClient(() => ({ facts: [] }))

    const result = await sliceResume('Some resume text', client as never, mockLog as never)

    expect(result).toEqual([])
  })

  it('returns empty array when LLM response is malformed', async () => {
    const client = {
      generate: vi.fn().mockResolvedValue('not json'),
    }

    const result = await sliceResume('Some resume text', client as never, mockLog as never)

    expect(result).toEqual([])
  })
})

describe('mapToInsert', () => {
  beforeEach(() => {
    mockLog.warn.mockClear()
  })

  it('defaults confidence to inferred when the model omits it', () => {
    const insert = mapToInsert({ label: 'TypeScript', category: 'skill' }, mockLog as never)

    expect(insert).toMatchObject({ label: 'TypeScript', category: 'skill', confidence: 'inferred' })
  })

  it('keeps an explicit stated confidence', () => {
    const insert = mapToInsert({ label: 'AWS Cert', category: 'credential', confidence: 'stated' }, mockLog as never)

    expect(insert).toMatchObject({ label: 'AWS Cert', confidence: 'stated' })
  })

  it('appends the source section note to detail', () => {
    const insert = mapToInsert(
      { label: 'TypeScript', category: 'skill', detail: '5 years' },
      mockLog as never,
      'Work History > Lead Engineer'
    )

    expect(insert?.detail).toBe('5 years [source: Work History > Lead Engineer]')
  })

  it('rejects a precedent_story without detail and logs a warning', () => {
    const insert = mapToInsert({ label: 'Shipped a pipeline', category: 'precedent_story' }, mockLog as never)

    expect(insert).toBeNull()
    expect(mockLog.warn).toHaveBeenCalled()
  })

  it('rejects a gap with an empty detail', () => {
    const insert = mapToInsert({ label: 'No CTO role', category: 'gap', detail: '   ' }, mockLog as never)

    expect(insert).toBeNull()
  })

  it('allows a skill with no detail', () => {
    const insert = mapToInsert({ label: 'TypeScript', category: 'skill' }, mockLog as never)

    expect(insert).toMatchObject({ label: 'TypeScript', category: 'skill', detail: null })
  })
})

function existingFact(overrides: { id: number; category: string; label: string } & Partial<Fact>): Fact {
  return {
    id: overrides.id,
    category: overrides.category,
    label: overrides.label,
    detail: overrides.detail ?? null,
    evidenceType: overrides.evidenceType ?? null,
    startedAt: overrides.startedAt ?? null,
    endedAt: overrides.endedAt ?? null,
    period: overrides.period ?? null,
    confidence: overrides.confidence ?? 'stated',
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? '2026-01-01 00:00:00',
    updatedAt: overrides.updatedAt ?? '2026-01-01 00:00:00',
  }
}

describe('mergeFacts', () => {
  it('skips a duplicate with identical category + label and matching fields', () => {
    const existing = [existingFact({ id: 1, category: 'skill', label: 'TypeScript', detail: '5 years' })]
    const proposed = [{ category: 'skill', label: 'TypeScript', detail: '5 years' }]

    const result = mergeFacts(existing, proposed)

    expect(result.inserts).toEqual([])
    expect(result.superseded).toEqual([])
  })

  it('inserts facts with no active existing match', () => {
    const existing = [existingFact({ id: 1, category: 'role', label: 'Lead Engineer' })]
    const proposed = [{ category: 'skill', label: 'TypeScript' }]

    const result = mergeFacts(existing, proposed)

    expect(result.inserts).toEqual([{ category: 'skill', label: 'TypeScript' }])
    expect(result.superseded).toEqual([])
  })

  it('marks a conflicting match as inferred and supersedes the existing row', () => {
    const existing = [existingFact({ id: 7, category: 'role', label: 'Tech Lead', startedAt: '2019-01' })]
    const proposed = [
      { category: 'role', label: 'Tech Lead', startedAt: '2020-01', endedAt: '2023-12', confidence: 'stated' },
    ]

    const result = mergeFacts(existing, proposed)

    expect(result.inserts).toHaveLength(1)
    expect(result.inserts[0]).toMatchObject({ category: 'role', label: 'Tech Lead', startedAt: '2020-01' })
    expect(result.inserts[0].confidence).toBe('inferred')
    expect(result.superseded).toEqual([7])
  })

  it('treats inactive existing rows as absent', () => {
    const existing = [existingFact({ id: 1, category: 'skill', label: 'TypeScript', detail: '5 years', active: false })]
    const proposed = [{ category: 'skill', label: 'TypeScript', detail: '5 years' }]

    const result = mergeFacts(existing, proposed)

    expect(result.inserts).toHaveLength(1)
    expect(result.superseded).toEqual([])
  })

  it('dedupes within the proposed batch itself', () => {
    const proposed = [
      { category: 'skill', label: 'TypeScript' },
      { category: 'skill', label: 'TypeScript' },
    ]

    const result = mergeFacts([], proposed)

    expect(result.inserts).toHaveLength(1)
  })
})
