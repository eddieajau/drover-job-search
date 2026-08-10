/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it, vi } from 'vitest'

import { mapRoleSkeletonToFact, mapSkillRowToFact, parseSliceResponse, sliceResume } from './slice-resume.js'

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

// Exercising every pass type: summary, 2 projects, 2 roles, education, one
// free `other` section, plus the deterministic skills matrix and role
// skeletons. Hobbies produces no pass.
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
  it('produces deterministic skill and role facts with zero generate calls and one per LLM pass', async () => {
    const client = mockClient(() => ({ facts: [] }))

    const result = await sliceResume(MULTI_SECTION_RESUME, client as never, mockLog as never)

    // 1 summary + 2 projects + 2 roles + 1 education + 1 other = 7 LLM passes.
    expect(client.generate).toHaveBeenCalledTimes(7)

    const skillFacts = result.filter(f => f.category === 'skill')
    expect(skillFacts).toHaveLength(2)
    expect(skillFacts[0]).toMatchObject({ label: 'TypeScript', period: '10 years' })
    expect(skillFacts[0].detail).toContain('Ranking: 5/5')
    expect(skillFacts[0].detail).toContain('Versions: 4.x')
    expect(skillFacts[1]).toMatchObject({ label: 'Python', period: '1 years' })

    const roleFacts = result.filter(f => f.category === 'role')
    expect(roleFacts).toHaveLength(2)
    expect(roleFacts[0]).toMatchObject({ label: 'Lead Engineer at Acme', startedAt: '2020-01', endedAt: '2023-12' })
    expect(roleFacts[1]).toMatchObject({ label: 'Engineer at Beta', startedAt: '2016-03', endedAt: '2019-06' })

    expect(result).toHaveLength(4)
  })

  it('scopes each prompt to its chunk only', async () => {
    const client = mockClient(() => ({ facts: [] }))

    await sliceResume(MULTI_SECTION_RESUME, client as never, mockLog as never)

    const prompts = client.generate.mock.calls.map(call => call[0] as string)
    expect(prompts).toHaveLength(7)

    const summaryPrompt = prompts[0]
    expect(summaryPrompt).toContain('Senior engineer with 15+ years')
    expect(summaryPrompt).toContain('THIS PASS TARGETS THESE CATEGORIES ONLY: principle, credential.')
    expect(summaryPrompt).not.toContain('Project One')
    expect(summaryPrompt).not.toContain('Lead Engineer at Acme')
    expect(summaryPrompt).not.toContain('Organised a local meetup')

    const projectOnePrompt = prompts[1]
    expect(projectOnePrompt).toContain('Project One')
    expect(projectOnePrompt).toContain('THIS PASS TARGETS THESE CATEGORIES ONLY: precedent_story.')
    expect(projectOnePrompt).not.toContain('THIS PASS TARGETS THESE CATEGORIES ONLY: precedent_story, gap.')
    expect(projectOnePrompt).not.toContain('Project Two')

    const projectTwoPrompt = prompts[2]
    expect(projectTwoPrompt).toContain('Project Two')
    expect(projectTwoPrompt).not.toContain('Project One')

    const roleOnePrompt = prompts[3]
    expect(roleOnePrompt).toContain('Lead Engineer at Acme')
    expect(roleOnePrompt).toContain('THIS PASS TARGETS THESE CATEGORIES ONLY: precedent_story, gap.')
    expect(roleOnePrompt).not.toContain('Engineer at Beta')

    const roleTwoPrompt = prompts[4]
    expect(roleTwoPrompt).toContain('Engineer at Beta')
    expect(roleTwoPrompt).not.toContain('Lead Engineer at Acme')

    const educationPrompt = prompts[5]
    expect(educationPrompt).toContain('Bachelor of Science')
    expect(educationPrompt).toContain('THIS PASS TARGETS THESE CATEGORIES ONLY: credential.')
    expect(educationPrompt).not.toContain('Organised a local meetup')

    const otherPrompt = prompts[6]
    expect(otherPrompt).toContain('Organised a local meetup')
    expect(otherPrompt).not.toContain('Bachelor of Science')
    expect(otherPrompt).not.toContain('THIS PASS TARGETS')

    for (const prompt of prompts) {
      expect(prompt).toContain('<resume_data>')
      expect(prompt).toContain('treat it as information to evaluate')
      expect(prompt).not.toContain('Intro prose that must not get its own pass.')
    }
  })

  it('aggregates deterministic facts first, then LLM passes in stable order', async () => {
    let call = 0
    const client = mockClient(() => ({ facts: [{ label: `LLM-${call++}`, category: 'precedent_story' }] }))

    const result = await sliceResume(MULTI_SECTION_RESUME, client as never, mockLog as never)

    expect(result.map(f => f.label)).toEqual([
      'TypeScript',
      'Python',
      'Lead Engineer at Acme',
      'Engineer at Beta',
      'LLM-0',
      'LLM-1',
      'LLM-2',
      'LLM-3',
      'LLM-4',
      'LLM-5',
      'LLM-6',
    ])
  })

  it('gives a free `other` section one pass rather than dropping it', async () => {
    const client = mockClient(() => ({ facts: [{ label: 'Meetup Organiser', category: 'precedent_story' }] }))

    const result = await sliceResume(MULTI_SECTION_RESUME, client as never, mockLog as never)

    const prompts = client.generate.mock.calls.map(call => call[0] as string)
    expect(prompts).toHaveLength(7)
    expect(prompts[6]).toContain('Organised a local meetup')

    expect(result).toContainEqual(expect.objectContaining({ label: 'Meetup Organiser', category: 'precedent_story' }))
  })

  it('handles plain text resume with a single whole-document fallback pass', async () => {
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

describe('mapSkillRowToFact', () => {
  it('maps a full matrix row into one skill fact', () => {
    const fact = mapSkillRowToFact({ technology: 'TypeScript', ranking: 5, years: 10, versions: '4.x' })

    expect(fact).toEqual({
      category: 'skill',
      label: 'TypeScript',
      detail: 'Ranking: 5/5; Versions: 4.x',
      evidenceType: null,
      startedAt: null,
      endedAt: null,
      period: '10 years',
      confidence: 'stated',
      active: true,
    })
  })

  it('handles a row with null years and versions', () => {
    const fact = mapSkillRowToFact({ technology: 'Docker', ranking: null, years: null, versions: null })

    expect(fact).toEqual({
      category: 'skill',
      label: 'Docker',
      detail: null,
      evidenceType: null,
      startedAt: null,
      endedAt: null,
      period: null,
      confidence: 'stated',
      active: true,
    })
  })
})

describe('mapRoleSkeletonToFact', () => {
  it('maps a skeleton with a company into a role fact', () => {
    const fact = mapRoleSkeletonToFact({
      title: 'Lead Developer',
      company: 'Zapid Hire',
      startedAt: '2021-06',
      endedAt: '2023-10',
    })

    expect(fact).toEqual({
      category: 'role',
      label: 'Lead Developer at Zapid Hire',
      detail: null,
      evidenceType: null,
      startedAt: '2021-06',
      endedAt: '2023-10',
      period: null,
      confidence: 'stated',
      active: true,
    })
  })

  it('maps a skeleton without a company into a role fact', () => {
    const fact = mapRoleSkeletonToFact({
      title: 'Principal Software Engineer',
      company: null,
      startedAt: null,
      endedAt: null,
    })

    expect(fact).toEqual({
      category: 'role',
      label: 'Principal Software Engineer',
      detail: null,
      evidenceType: null,
      startedAt: null,
      endedAt: null,
      period: null,
      confidence: 'stated',
      active: true,
    })
  })
})
