/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { EventEmitter } from 'node:events'

import { type DB } from 'db'
import type { FastifyBaseLogger } from 'fastify'
import { detail } from 'provider-linkedin'
import { createWorkerLoop, fetchJobDetails } from 'workers'

import type { BusEvents } from '../bus.js'

export type StopFn = () => void

export function startDetailsWorker(
  bus: EventEmitter<BusEvents>,
  db: DB,
  log: Pick<FastifyBaseLogger, 'debug' | 'info' | 'warn' | 'error'>
): StopFn {
  const loop = createWorkerLoop({
    drain: () =>
      fetchJobDetails
        .drain(db, {
          detailFn: detail,
          onProgress: row => log.info({ providerJobId: row.providerJobId }, 'description saved'),
          onError: (row, err) =>
            err === null
              ? log.warn({ providerJobId: row.providerJobId }, 'no description; marked done')
              : log.error({ providerJobId: row.providerJobId, err }, 'detail fetch failed; marked done'),
        })
        .then(r => ({ total: r.processed + r.failed })),
    onEmpty: () => bus.emit('descriptions-ready', { jobId: 0 }),
    log,
  })
  const onFlagged = (_payload: { jobId: number }) => loop.kick()
  bus.on('flagged', onFlagged)
  return () => {
    bus.off('flagged', onFlagged)
    loop.stop()
  }
}
