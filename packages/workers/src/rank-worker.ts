/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { type DB } from 'db'
import type { FastifyBaseLogger } from 'fastify'

import { createOllamaClient } from './clients/ollama.js'
import type { DetailsWorker } from './details-worker.js'
import { createWorkerLoop } from './loop.js'
import * as rankJobDetails from './topics/rankJobDetails.js'

export function startRankWorker(opts: {
  db: DB
  log: Pick<FastifyBaseLogger, 'debug' | 'info' | 'warn' | 'error'>
  ollamaBaseUrl?: string
  ollamaModel?: string
}): DetailsWorker {
  const client = createOllamaClient(opts.ollamaBaseUrl, opts.ollamaModel, opts.log)
  const loop = createWorkerLoop({
    drain: () =>
      rankJobDetails
        .drain(opts.db, {
          client,
          onProgress: row => opts.log.info({ jobId: row.jobId, title: row.title }, 'evaluated'),
          onError: (row, err) =>
            opts.log.warn({ jobId: row.jobId, err: err instanceof Error ? err.message : err }, 'inference skipped'),
        })
        .then(r => ({ total: r.written + r.skipped })),
    log: opts.log,
  })
  return { kick: loop.kick, stop: loop.stop }
}
