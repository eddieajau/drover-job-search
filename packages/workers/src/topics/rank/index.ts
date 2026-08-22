/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { facts, jobSignals, jobs, type DB, type Fact } from 'db'
import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'

import { createOllamaClient, type OllamaClient } from '../../clients/ollama.js'
import { createConsumer, type Consumer } from '../../consumer.js'
import { drainRows } from '../../lib/drainQueue.js'
import { reconcileBlockedForJob } from '../../lib/reconcileBlocked.js'
import { sanitise } from '../../lib/sanitise.js'
import { complete, fail, selectPendingRow, type PendingRow } from '../../queue.js'
import { buildPrompt } from './llmRequest.js'
import { parseLlmResponse } from './llmResponse.js'

// Legitimate skips (missing job, blocked status, no description) complete the
// queue row — nothing was attempted, and retrying wouldn't help. Inference
// failures (Ollama unreachable, unparseable response) fail the row instead:
// work was attempted and did not happen, so completing would be a false
// positive. Both paths are terminal so a drain pass terminates; retrying
// failed rows is deferred to a later iteration.

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
        log: opts.log,
        onProgress: row => opts.log.debug({ jobId: row.jobId, title: row.title }, 'evaluated'),
        onError: (row, err) =>
          opts.log.warn({ jobId: row.jobId, err: err instanceof Error ? err.message : err }, 'inference skipped'),
      }).then(r => ({ total: r.written + r.skipped })),
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

export async function drain(db: DB, opts: RankDrainOptions): Promise<{ written: number; skipped: number }> {
  const activeFacts = db.select().from(facts).where(eq(facts.active, true)).all()
  return drainRows(db, 'rank', {
    limit: opts.limit,
    processRow: row => drainOne(db, row.queueId, opts, activeFacts),
    // Rank never fails a row mid-drain (see drainOne) so `failed` is always 0.
  }).then(({ written, skipped }) => ({ written, skipped }))
}

export async function drainOne(
  db: DB,
  queueId: number,
  opts: RankDrainOptions,
  activeFacts?: Fact[]
): Promise<'written' | 'skipped'> {
  const row = selectPendingRow(db, 'rank', queueId)
  if (!row) return 'skipped'
  return evaluateJob(db, row, opts, activeFacts)
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
      status: jobs.status,
    })
    .from(jobs)
    .where(eq(jobs.id, row.jobId))
    .get()

  if (!job) {
    complete(db, row.queueId)
    return 'skipped'
  }

  if (job.status === 'blocked') {
    complete(db, row.queueId)
    return 'skipped'
  }

  if (!job.description?.trim()) {
    reconcileBlockedForJob(db, row.jobId)
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
    fail(db, row.queueId, err instanceof Error ? err.message : String(err))
    opts.onError?.(row, err)
    return 'skipped'
  }

  const result = parseLlmResponse(raw)
  if (!result) {
    opts.log?.error({ jobId: row.jobId, raw }, 'invalid LLM response')
    fail(db, row.queueId, 'invalid LLM response')
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

  complete(db, row.queueId)
  opts.onProgress?.(row)
  opts.log?.info({ jobId: row.jobId, title: row.title }, 'job ranked')
  return 'written'
}
