/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobSignals, jobs, type DB } from 'db'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import type { Logger } from 'pino'

import type { OllamaClient } from './ollama.js'
import { buildPrompt } from './prompt.js'
import { sanitise } from './sanitise.js'

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

function parseLlmResponse(raw: string): LlmEvalResult | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || !Array.isArray(parsed.gates) || !Array.isArray(parsed.dimensions)) {
      return null
    }

    const gates: GateVerdict[] = []
    for (const gate of parsed.gates) {
      if (!isRecord(gate) || !isGateName(gate.name) || typeof gate.passed !== 'boolean') {
        return null
      }
      gates.push({
        name: gate.name,
        passed: gate.passed,
        score: typeof gate.score === 'number' ? gate.score : DEFAULT_GATE_SCORE,
        reason: typeof gate.reason === 'string' ? gate.reason : '',
      })
    }

    const dimensions: DimensionScore[] = []
    for (const dim of parsed.dimensions) {
      if (
        !isRecord(dim) ||
        !isDimensionName(dim.name) ||
        !SIGNAL_TYPES.includes(dim.signal_type as (typeof SIGNAL_TYPES)[number]) ||
        typeof dim.score !== 'number' ||
        !Array.isArray(dim.matched_keywords) ||
        typeof dim.reason !== 'string'
      ) {
        return null
      }
      dimensions.push({
        name: dim.name,
        signal_type: dim.signal_type as DimensionScore['signal_type'],
        score: clamp(dim.score, 0, 100),
        matched_keywords: dim.matched_keywords.filter((k: unknown) => typeof k === 'string'),
        reason: dim.reason,
      })
    }

    return { gates, dimensions }
  } catch {
    return null
  }
}

export async function evaluateJob(
  db: DB,
  jobId: number,
  client: OllamaClient,
  log?: Logger
): Promise<'written' | 'skipped'> {
  const job = db
    .select({
      id: jobs.id,
      title: jobs.title,
      companyName: jobs.companyName,
      location: jobs.location,
      description: jobs.description,
    })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .get()

  if (!job || !job.description) {
    log?.warn({ jobId, hasJob: !!job }, 'job has no description; skipping')
    return 'skipped'
  }

  log?.info({ jobId, title: job.title, companyName: job.companyName }, 'evaluating job')

  const cleanDesc = sanitise(job.description)
  log?.debug(
    { jobId, rawDescLength: job.description.length, cleanDescLength: cleanDesc.length },
    'description sanitised'
  )

  const prompt = buildPrompt({
    title: job.title,
    companyName: job.companyName,
    location: job.location,
    description: cleanDesc,
  })
  log?.debug({ jobId, promptLength: prompt.length }, 'prompt built')

  let raw: string
  try {
    raw = await client.generate(prompt)
  } catch (err) {
    log?.error(
      { jobId, err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      'ollama generate failed; skipping'
    )
    return 'skipped'
  }

  log?.debug({ jobId, rawLength: raw.length, rawPreview: raw.slice(0, 100) }, 'raw LLM response')

  const result = parseLlmResponse(raw)
  if (!result) {
    log?.warn({ jobId, rawLength: raw.length, rawPreview: raw.slice(0, 500) }, 'invalid LLM response; skipping')
    return 'skipped'
  }

  db.delete(jobSignals)
    .where(and(eq(jobSignals.jobId, jobId), isNull(jobSignals.ruleId), eq(jobSignals.source, 'llm_deep_eval')))
    .run()

  const values: (typeof jobSignals.$inferInsert)[] = []

  for (const gate of result.gates) {
    if (gate.passed) {
      continue
    }
    values.push({
      jobId,
      ruleId: null,
      source: 'llm_deep_eval',
      signalType: 'dealbreaker',
      score: gate.score,
      metadata: JSON.stringify({ gate: gate.name, reason: gate.reason }),
    })
  }

  for (const dim of result.dimensions) {
    values.push({
      jobId,
      ruleId: null,
      source: 'llm_deep_eval',
      signalType: dim.signal_type,
      score: dim.score,
      metadata: JSON.stringify({ dimension: dim.name, matched_keywords: dim.matched_keywords, reason: dim.reason }),
    })
  }

  if (values.length > 0) {
    db.insert(jobSignals).values(values).run()
  }

  log?.info(
    { jobId, gates: result.gates.filter(g => !g.passed).length, dimensions: result.dimensions.length },
    'llm_deep_eval signals written'
  )
  return 'written'
}

export function selectJobsForEval(db: DB): { id: number }[] {
  const evaluatedJobIds = db
    .select({ jobId: jobSignals.jobId })
    .from(jobSignals)
    .where(and(eq(jobSignals.source, 'llm_deep_eval'), isNull(jobSignals.ruleId)))
    .all()
    .map(r => r.jobId)

  const seen = new Set(evaluatedJobIds)

  return db
    .select({ id: jobs.id })
    .from(jobs)
    .where(isNotNull(jobs.description))
    .all()
    .filter(j => !seen.has(j.id))
}
