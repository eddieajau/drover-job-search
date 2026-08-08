/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it, vi } from 'vitest'

import { parseSliceResponse, sliceResume } from './slice-resume.js'

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

describe('sliceResume', () => {
  it('handles plain text resume', async () => {
    const client = {
      generate: vi.fn().mockResolvedValue(JSON.stringify({ facts: [{ label: 'TypeScript', category: 'skill' }] })),
    }

    const result = await sliceResume('I have 5 years of TypeScript experience.', client, mockLog as never)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ label: 'TypeScript', category: 'skill' })
    expect(client.generate).toHaveBeenCalledOnce()
  })

  it('handles markdown resume with headings and lists', async () => {
    const client = {
      generate: vi.fn().mockResolvedValue(
        JSON.stringify({
          facts: [
            { label: 'React', category: 'skill' },
            { label: 'Tech Lead', category: 'role' },
          ],
        })
      ),
    }

    const markdownResume = `# Experience

## Senior Developer at Acme Corp (2020-2024)

- Led team of 5 engineers
- Built React applications with TypeScript
- Implemented CI/CD pipelines

## Skills

- React
- TypeScript
- Node.js`

    const result = await sliceResume(markdownResume, client, mockLog as never)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ label: 'React', category: 'skill' })
    expect(result[1]).toMatchObject({ label: 'Tech Lead', category: 'role' })

    const prompt = client.generate.mock.calls[0][0]
    expect(prompt).toContain('<resume_data>')
    expect(prompt).toContain('# Experience')
  })

  it('sanitises control characters from resume', async () => {
    const client = {
      generate: vi.fn().mockResolvedValue(JSON.stringify({ facts: [{ label: 'Clean Skill', category: 'skill' }] })),
    }

    const dirtyResume = 'Skill with\u0000null\u001B[31mansi\u200Bzero-width'

    await sliceResume(dirtyResume, client, mockLog as never)

    const prompt = client.generate.mock.calls[0][0]
    expect(prompt).not.toContain('\u0000')
    expect(prompt).not.toContain('\u001B')
    expect(prompt).not.toContain('\u200B')
  })

  it('returns empty array when LLM returns no valid facts', async () => {
    const client = {
      generate: vi.fn().mockResolvedValue(JSON.stringify({ facts: [] })),
    }

    const result = await sliceResume('Some resume text', client, mockLog as never)

    expect(result).toEqual([])
  })

  it('returns empty array when LLM response is malformed', async () => {
    const client = {
      generate: vi.fn().mockResolvedValue('not json'),
    }

    const result = await sliceResume('Some resume text', client, mockLog as never)

    expect(result).toEqual([])
  })
})
