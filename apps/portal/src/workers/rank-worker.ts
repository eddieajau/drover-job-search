/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { EventEmitter } from 'node:events'

import { type DB } from 'db'
import type { FastifyBaseLogger } from 'fastify'
import { createWorkerLoop, rankJobDetails } from 'workers'

import type { BusEvents } from '../bus.js'

export type StopFn = () => void

export function startRankWorker(
  bus: EventEmitter<BusEvents>,
  db: DB,
  log: Pick<FastifyBaseLogger, 'debug' | 'info' | 'warn' | 'error'>
): StopFn {
  const loop = createWorkerLoop({
    drain: () =>
      rankJobDetails
        .drain(db, {
          client: rankJobDetails.createOllamaClient(process.env.OLLAMA_BASE_URL, process.env.OLLAMA_MODEL, log),
          onProgress: row => log.info({ jobId: row.jobId, title: row.title }, 'evaluated'),
          onError: (row, err) =>
            log.warn({ jobId: row.jobId, err: err instanceof Error ? err.message : err }, 'inference skipped'),
        })
        .then(r => ({ total: r.written + r.skipped })),
    log,
  })
  const onDescriptionsReady = (_payload: { jobId: number }) => loop.kick()
  bus.on('descriptions-ready', onDescriptionsReady)
  return () => {
    bus.off('descriptions-ready', onDescriptionsReady)
    loop.stop()
  }
}
