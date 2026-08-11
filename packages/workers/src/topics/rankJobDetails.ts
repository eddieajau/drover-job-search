/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, facts, jobSignals, jobs, type DB, type Fact } from 'db'
import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'

import { createOllamaClient, type OllamaClient } from '../clients/ollama.js'
import { createConsumer, type Consumer } from '../consumer.js'
import { sanitise } from '../lib/sanitise.js'
import { complete, selectPending, type PendingRow } from '../queue.js'
import { buildPrompt } from './prompt.js'

// Skips mark the queue row done rather than leaving it pending. A missing
// description and invalid LLM output are deterministic — retrying won't help,
// and failing the row would re-drain it forever. The fetch-job-details drain
// marks failures done too (via fail()), so both drains keep the portal worker
// loop from spinning; retrying failed rows is deferred to a later iteration.

export { createOllamaClient }

export function createRankConsumer(opts: {
  db: DB
  log: Pick<FastifyBaseLogger, 'debug' | 'info' | 'warn' | 'error'>
  ollamaBaseUrl?: string
  ollamaModel?: string
}): Consumer {
  const client = createOllamaClient(opts.ollamaBaseUrl, opts.ollamaModel, opts.log)
  return createConsumer({
    topic: 'rank',
    drain: () =>
      drain(opts.db, {
        client,
        onProgress: row => opts.log.info({ jobId: row.jobId, title: row.title }, 'evaluated'),
        onError: (row, err) =>
          opts.log.warn({ jobId: row.jobId, err: err instanceof Error ? err.message : err }, 'inference skipped'),
      }).then(r => ({ total: r.written + r.skipped })),
    log: opts.log,
  })
}

const GATE_NAMES = ['eligibility', 'language', 'location'] as const
const DIMENSION_NAMES = ['technical', 'experience', 'behavioral', 'career'] as const
const SIGNAL_TYPES = ['skill_match', 'company_match'] as const
const DEFAULT_GATE_SCORE = -100

type GateName = (typeof GATE_NAMES)[number]
type DimensionName = (typeof DIMENSION_NAMES)[number]

interface GateVerdict {
  name: GateName
  passed: boolean
  score: number
  reason: string
}

interface DimensionScore {
  name: DimensionName
  signal_type: (typeof SIGNAL_TYPES)[number]
  score: number
  matched_keywords: string[]
  reason: string
}

interface LlmEvalResult {
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

export interface RankDrainOptions {
  client: OllamaClient
  limit?: number
  onProgress?: (row: PendingRow) => void
  onError?: (row: PendingRow, err: unknown) => void
}

export async function drain(db: DB, opts: RankDrainOptions): Promise<{ written: number; skipped: number }> {
  const rows = selectPending(db, 'rank', opts.limit)
  const activeFacts = db.select().from(facts).where(eq(facts.active, true)).all()
  let written = 0
  let skipped = 0
  for (const row of rows) {
    const outcome = await drainOne(db, row.queueId, opts, activeFacts)
    if (outcome === 'written') written++
    else skipped++
  }
  return { written, skipped }
}

export async function drainOne(
  db: DB,
  queueId: number,
  opts: RankDrainOptions,
  activeFacts?: Fact[]
): Promise<'written' | 'skipped'> {
  const row = selectPendingRow(db, queueId)
  if (!row) return 'skipped'
  return evaluateJob(db, row, opts, activeFacts)
}

function selectPendingRow(db: DB, queueId: number): PendingRow | null {
  return (
    db
      .select({
        queueId: analysisQueue.id,
        jobId: jobs.id,
        providerJobId: jobs.providerJobId,
        title: jobs.title,
      })
      .from(analysisQueue)
      .innerJoin(jobs, eq(analysisQueue.jobId, jobs.id))
      .where(and(eq(analysisQueue.id, queueId), eq(analysisQueue.topic, 'rank'), isNull(analysisQueue.completedAt)))
      .get() ?? null
  )
}

async function evaluateJob(
  db: DB,
  row: PendingRow,
  opts: RankDrainOptions,
  activeFacts?: Fact[]
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
    .where(eq(jobs.id, row.jobId))
    .get()

  if (!job?.description) {
    complete(db, row.queueId)
    opts.onError?.(row, new Error('job has no description'))
    return 'skipped'
  }

  const cleanDesc = sanitise(job.description)
  const factsForPrompt = activeFacts ?? db.select().from(facts).where(eq(facts.active, true)).all()
  const prompt = buildPrompt(
    {
      title: job.title,
      companyName: job.companyName,
      location: job.location,
      description: cleanDesc,
    },
    factsForPrompt
  )

  let raw: string
  try {
    raw = await opts.client.generate(prompt)
  } catch (err) {
    complete(db, row.queueId)
    opts.onError?.(row, err)
    return 'skipped'
  }

  const result = parseLlmResponse(raw)
  if (!result) {
    complete(db, row.queueId)
    opts.onError?.(row, new Error('invalid LLM response'))
    return 'skipped'
  }

  db.delete(jobSignals)
    .where(and(eq(jobSignals.jobId, row.jobId), isNull(jobSignals.ruleId), eq(jobSignals.source, 'llm_deep_eval')))
    .run()

  const values: (typeof jobSignals.$inferInsert)[] = []

  for (const gate of result.gates) {
    if (gate.passed) {
      continue
    }
    values.push({
      jobId: row.jobId,
      ruleId: null,
      source: 'llm_deep_eval',
      signalType: 'dealbreaker',
      score: gate.score,
      metadata: JSON.stringify({ gate: gate.name, reason: gate.reason }),
    })
  }

  for (const dim of result.dimensions) {
    values.push({
      jobId: row.jobId,
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

  complete(db, row.queueId)
  opts.onProgress?.(row)
  return 'written'
}
