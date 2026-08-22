/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it } from 'vitest'

import { parseLlmResponse, RankParseError, validateEval } from './llmResponse.js'

const validEval = {
  gates: [{ name: 'eligibility', passed: true, score: 0, reason: 'ok' }],
  dimensions: [
    { name: 'technical', signal_type: 'skill_match', score: 75, matched_keywords: ['TypeScript'], reason: 'strong' },
  ],
  strengths: ['Deep TypeScript match'],
  gaps: [],
}

describe('validateEval', () => {
  it('parses a valid payload', () => {
    expect(validateEval(validEval)).toEqual(validEval)
  })

  it('throws RankParseError when gates or dimensions are missing', () => {
    expect(() => validateEval({})).toThrow(RankParseError)
    expect(() => validateEval({ gates: [] })).toThrow(RankParseError)
  })

  it('throws RankParseError when a gate has an invalid name', () => {
    const bad = { ...validEval, gates: [{ name: 'salary', passed: false }] }
    expect(() => validateEval(bad)).toThrow(RankParseError)
  })

  it('throws RankParseError when a dimension signal_type is invalid', () => {
    const bad = {
      ...validEval,
      dimensions: [{ name: 'technical', signal_type: 'nope', score: 1, matched_keywords: [], reason: 'x' }],
    }
    expect(() => validateEval(bad)).toThrow(RankParseError)
  })
})

describe('parseLlmResponse', () => {
  it('parses clean JSON', () => {
    expect(parseLlmResponse(JSON.stringify(validEval))).toEqual(validEval)
  })

  it('parses JSON wrapped in leaked thinking-model scaffolding', () => {
    // Reproduces a real incident: the model emitted the eval inside a
    // hallucinated tool call, then again as clean JSON after </think>.
    const raw = `${JSON.stringify(validEval)}</parameter>\n</invoke>\n</think>\n\n${JSON.stringify(validEval, null, 2)}`
    expect(parseLlmResponse(raw)).toEqual(validEval)
  })

  it('repairs a payload truncated mid-object', () => {
    const raw = JSON.stringify(validEval).slice(0, -1)
    expect(parseLlmResponse(raw)).toEqual(validEval)
  })

  it('skips an invalid candidate and takes the next balanced block', () => {
    const raw = `{"unrelated": true}${JSON.stringify(validEval)}`
    expect(parseLlmResponse(raw)).toEqual(validEval)
  })

  it('throws RankParseError on garbage', () => {
    expect(() => parseLlmResponse('not json')).toThrow(RankParseError)
  })

  it('throws RankParseError on an empty payload', () => {
    expect(() => parseLlmResponse('')).toThrow(RankParseError)
  })

  it('includes a snippet of the raw payload in the error message', () => {
    expect(() => parseLlmResponse('utter garbage')).toThrow(/len=13 body="utter garbage"/)
  })

  it('reports both ends of a long payload so truncation is visible', () => {
    const long = `${'x'.repeat(200)}MIDDLE${'y'.repeat(200)}`
    try {
      parseLlmResponse(long)
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(RankParseError)
      const message = (err as Error).message
      expect(message).toContain(`len=${long.length}`)
      expect(message).toContain('x'.repeat(50))
      expect(message).toContain('y'.repeat(50))
      expect(message).not.toContain('MIDDLE')
    }
  })

  it('caps each end of a long payload to keep the message readable', () => {
    const long = 'x'.repeat(500)
    try {
      parseLlmResponse(long)
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(RankParseError)
      expect((err as Error).message.length).toBeLessThan(400)
    }
  })
})
