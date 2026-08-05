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

export interface LlmEvalResult {
  score: number
  signal_type: string
  matched_keywords: string[]
  reason: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parseLlmResponse(raw: string): LlmEvalResult | null {
  try {
    const parsed = JSON.parse(raw)

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.score !== 'number' ||
      typeof parsed.signal_type !== 'string' ||
      !Array.isArray(parsed.matched_keywords) ||
      typeof parsed.reason !== 'string'
    ) {
      return null
    }

    if (!['dealbreaker', 'skill_match', 'company_match'].includes(parsed.signal_type)) {
      return null
    }

    return {
      score: clamp(parsed.score, -100, 100),
      signal_type: parsed.signal_type,
      matched_keywords: parsed.matched_keywords.filter((k: unknown) => typeof k === 'string'),
      reason: parsed.reason,
    }
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

  db.insert(jobSignals)
    .values({
      jobId,
      ruleId: null,
      source: 'llm_deep_eval',
      signalType: result.signal_type,
      score: result.score,
      metadata: JSON.stringify({ matched_keywords: result.matched_keywords, reason: result.reason }),
    })
    .run()

  log?.info({ jobId, score: result.score, signalType: result.signal_type }, 'llm_deep_eval signal written')
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
