/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

// Pure LLM response parsing: no logging, no DB access.

const GATE_NAMES = ['eligibility', 'language', 'location'] as const
const DIMENSION_NAMES = ['technical', 'experience', 'behavioral', 'career'] as const
const SIGNAL_TYPES = ['skill_match', 'company_match'] as const
const DEFAULT_GATE_SCORE = -100

export type GateName = (typeof GATE_NAMES)[number]
export type DimensionName = (typeof DIMENSION_NAMES)[number]

export interface GateVerdict {
  name: GateName
  passed: boolean
  score: number
  reason: string
}

export interface DimensionScore {
  name: DimensionName
  signal_type: (typeof SIGNAL_TYPES)[number]
  score: number
  matched_keywords: string[]
  reason: string
}

export interface LlmEvalResult {
  gates: GateVerdict[]
  dimensions: DimensionScore[]
  strengths: string[]
  gaps: string[]
}

const MAX_WHY_BULLETS = 3

// Thrown when a payload cannot be turned into a valid eval. The message
// carries a snippet of the offending input so queue rows and logs show what
// the model actually said.
export class RankParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RankParseError'
  }
}

// Collapse whitespace and cap the snippet so error messages stay readable.
const SNIPPET_LENGTH = 120

function snippet(raw: string): string {
  const flat = raw.replace(/\s+/g, ' ').trim()
  if (flat === '') return '(empty)'
  return flat.length > SNIPPET_LENGTH ? `${flat.slice(0, SNIPPET_LENGTH)}…` : flat
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isGateName(value: unknown): value is GateName {
  return typeof value === 'string' && (GATE_NAMES as readonly string[]).includes(value)
}

function isDimensionName(value: unknown): value is DimensionName {
  return typeof value === 'string' && (DIMENSION_NAMES as readonly string[]).includes(value)
}

function parseWhyList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string').slice(0, MAX_WHY_BULLETS)
}

// Thinking models sometimes wrap the JSON in leaked scaffolding (`<think>`
// blocks, tool-call tokens, markdown fences), emit it twice, or truncate it
// mid-object when the token budget runs out. Scan for top-level {...}
// candidates and take the first that parses and validates instead of
// requiring the whole payload to be clean JSON; a candidate left open at end
// of input gets its missing closers (and any dangling string quote) repaired
// before the attempt — shape validation still decides if it is usable.
function* jsonCandidates(raw: string): Generator<string> {
  const stack: string[] = []
  let start = -1
  let inString = false
  let escape = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
    } else if (ch === '{' || ch === '[') {
      if (stack.length === 0) start = i
      stack.push(ch)
    } else if (ch === '}' || ch === ']') {
      if (stack.pop() === undefined) start = -1
      else if (stack.length === 0) {
        yield raw.slice(start, i + 1)
        start = -1
      }
    }
  }

  // Truncated payload: repair by closing an open string, dropping a dangling
  // escape, then appending the closers for whatever is still open.
  if (start !== -1 && stack.length > 0) {
    let candidate = escape ? raw.slice(start, -1) : raw.slice(start)
    if (inString) candidate += '"'
    for (const open of stack.reverse()) {
      candidate += open === '{' ? '}' : ']'
    }
    yield candidate
  }
}

export function validateEval(parsed: unknown): LlmEvalResult {
  if (!isRecord(parsed) || !Array.isArray(parsed.gates) || !Array.isArray(parsed.dimensions)) {
    throw new RankParseError('eval must be an object with gates and dimensions arrays')
  }

  const gates: GateVerdict[] = []
  for (const [i, gate] of parsed.gates.entries()) {
    if (!isRecord(gate) || !isGateName(gate.name) || typeof gate.passed !== 'boolean') {
      throw new RankParseError(`invalid gate verdict at index ${i}`)
    }
    gates.push({
      name: gate.name,
      passed: gate.passed,
      score: typeof gate.score === 'number' ? gate.score : DEFAULT_GATE_SCORE,
      reason: typeof gate.reason === 'string' ? gate.reason : '',
    })
  }

  const dimensions: DimensionScore[] = []
  for (const [i, dim] of parsed.dimensions.entries()) {
    if (
      !isRecord(dim) ||
      !isDimensionName(dim.name) ||
      !SIGNAL_TYPES.includes(dim.signal_type as (typeof SIGNAL_TYPES)[number]) ||
      typeof dim.score !== 'number' ||
      !Array.isArray(dim.matched_keywords) ||
      typeof dim.reason !== 'string'
    ) {
      throw new RankParseError(`invalid dimension score at index ${i}`)
    }
    dimensions.push({
      name: dim.name,
      signal_type: dim.signal_type as DimensionScore['signal_type'],
      score: clamp(dim.score, 0, 100),
      matched_keywords: dim.matched_keywords.filter((k: unknown) => typeof k === 'string'),
      reason: dim.reason,
    })
  }

  return { gates, dimensions, strengths: parseWhyList(parsed.strengths), gaps: parseWhyList(parsed.gaps) }
}

// Scan candidates silently — a block that fails to parse or validate is not
// an error, only exhausting all candidates is.
export function parseLlmResponse(raw: string): LlmEvalResult {
  for (const candidate of jsonCandidates(raw)) {
    try {
      return validateEval(JSON.parse(candidate))
    } catch {
      // Malformed candidate — try the next balanced block.
    }
  }
  throw new RankParseError(`no valid eval JSON in LLM response: ${snippet(raw)}`)
}
