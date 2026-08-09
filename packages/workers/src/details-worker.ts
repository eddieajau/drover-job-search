/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { type DB } from 'db'
import type { FastifyBaseLogger } from 'fastify'

import { createWorkerLoop } from './loop.js'
import * as fetchJobDetails from './topics/fetchJobDetails.js'

export interface DetailsWorker {
  kick(): void
  stop(): void
}

export function startDetailsWorker(opts: {
  db: DB
  log: Pick<FastifyBaseLogger, 'debug' | 'info' | 'warn' | 'error'>
  onDrained?: () => void
  detailFn: fetchJobDetails.DetailFn
}): DetailsWorker {
  const loop = createWorkerLoop({
    drain: () =>
      fetchJobDetails
        .drain(opts.db, {
          detailFn: opts.detailFn,
          onProgress: row => opts.log.info({ providerJobId: row.providerJobId }, 'description saved'),
          onError: (row, err) =>
            err === null
              ? opts.log.warn({ providerJobId: row.providerJobId }, 'no description; marked done')
              : opts.log.error({ providerJobId: row.providerJobId, err }, 'detail fetch failed; marked done'),
        })
        .then(r => ({ total: r.processed + r.failed })),
    onEmpty: () => opts.onDrained?.(),
    log: opts.log,
  })
  return { kick: loop.kick, stop: loop.stop }
}
