/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { facts, jobSignals, jobs, type DB, type Fact } from 'db'
import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'

import { createOllamaClient, type OllamaClient } from '../../clients/ollama.js'
import { createConsumer, type Consumer } from '../../consumer.js'
import { drainRows, type RowOutcome } from '../../lib/drainQueue.js'
import { reconcileBlockedForJob } from '../../lib/reconcileBlocked.js'
import { sanitise } from '../../lib/sanitise.js'
import { complete, fail, selectPendingRow, type PendingRow } from '../../queue.js'
import { buildPrompt } from './llmRequest.js'
import { parseLlmResponse } from './llmResponse.js'

// Control flow: worker steps throw and drainOne is the single catch point
// that decides the queue outcome. A SkipError (missing job, blocked status,
// no description) completes the row — nothing was attempted, and retrying
// wouldn't help. Anything else is an inference failure (Ollama unreachable,
// unparseable response) and fails the row instead: work was attempted and did
// not happen, so completing would be a false positive. Both outcomes are
// terminal so a drain pass terminates; retrying failed rows is deferred to a
// later iteration.

export { createOllamaClient }

export type SkipReason = 'job missing' | 'job blocked' | 'job has no description'

export class SkipError extends Error {
  constructor(readonly reason: SkipReason) {
    super(reason)
    this.name = 'SkipError'
  }
}

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
      drain(opts.db, { client, log: opts.log }).then(({ written, skipped, failed }) => ({
        total: written + skipped + failed,
      })),
    log: opts.log,
  })
}

export interface RankDrainOptions {
  client: OllamaClient
  log?: Pick<FastifyBaseLogger, 'debug' | 'info' | 'warn' | 'error'>
  limit?: number
  onProgress?: (row: PendingRow) => void
  onError?: (row: PendingRow, err: unknown) => void
}

export async function drain(
  db: DB,
  opts: RankDrainOptions
): Promise<{ written: number; skipped: number; failed: number }> {
  const activeFacts = db.select().from(facts).where(eq(facts.active, true)).all()
  return drainRows(db, 'rank', {
    limit: opts.limit,
    processRow: row => drainOne(db, row.queueId, opts, activeFacts),
  })
}

export async function drainOne(
  db: DB,
  queueId: number,
  opts: RankDrainOptions,
  activeFacts?: Fact[]
): Promise<RowOutcome> {
  const row = selectPendingRow(db, 'rank', queueId)
  if (!row) return 'skipped'
  // Lifecycle: one start line per claimed row, one terminal line per outcome
  // (ranked/skipped/failed) so a start never dangles without its terminal.
  const startMs = performance.now()
  opts.log?.info({ jobId: row.jobId, providerJobId: row.providerJobId }, 'evaluating job')
  try {
    const { llmMs, parseMs } = await evaluateJob(db, row, opts, activeFacts)
    complete(db, row.queueId)
    opts.onProgress?.(row)
    const totalMs = Math.round(performance.now() - startMs)
    opts.log?.info({ jobId: row.jobId, title: row.title, llmMs, parseMs, totalMs }, 'job ranked')
    return 'written'
  } catch (err) {
    if (err instanceof SkipError) {
      complete(db, row.queueId)
      opts.log?.debug({ jobId: row.jobId, reason: err.reason }, 'rank skipped')
      return 'skipped'
    }
    const message = err instanceof Error ? err.message : String(err)
    fail(db, row.queueId, message)
    opts.onError?.(row, err)
    opts.log?.warn({ jobId: row.jobId, err: message }, 'inference skipped')
    return 'failed'
  }
}

async function evaluateJob(
  db: DB,
  row: PendingRow,
  opts: RankDrainOptions,
  activeFacts?: Fact[]
): Promise<{ llmMs: number; parseMs: number }> {
  const job = db
    .select({
      id: jobs.id,
      title: jobs.title,
      companyName: jobs.companyName,
      location: jobs.location,
      description: jobs.description,
      status: jobs.status,
    })
    .from(jobs)
    .where(eq(jobs.id, row.jobId))
    .get()

  if (!job) throw new SkipError('job missing')

  if (job.status === 'blocked') throw new SkipError('job blocked')

  if (!job.description?.trim()) {
    reconcileBlockedForJob(db, row.jobId)
    throw new SkipError('job has no description')
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

  // Both inference steps throw on failure; drainOne maps that to a failed row.
  const llmStart = performance.now()
  const raw = await opts.client.generate(prompt)
  const llmMs = Math.round(performance.now() - llmStart)

  const parseStart = performance.now()
  const result = parseLlmResponse(raw)
  const parseMs = Math.round(performance.now() - parseStart)

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

  if (result.strengths.length > 0 || result.gaps.length > 0) {
    values.push({
      jobId: row.jobId,
      ruleId: null,
      source: 'llm_deep_eval',
      signalType: 'eval_summary',
      score: 0,
      metadata: JSON.stringify({ strengths: result.strengths, gaps: result.gaps }),
    })
  }

  if (values.length > 0) {
    db.insert(jobSignals).values(values).run()
  }

  reconcileBlockedForJob(db, row.jobId)

  return { llmMs, parseMs }
}
