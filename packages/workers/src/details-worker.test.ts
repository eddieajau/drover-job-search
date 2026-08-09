/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { createDb } from 'db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkerLoopOptions } from './loop.js'

const { kickFn, stopFn, captured } = vi.hoisted(() => ({
  kickFn: vi.fn(),
  stopFn: vi.fn(),
  captured: { opts: undefined as WorkerLoopOptions | undefined },
}))

vi.mock('./loop.js', () => ({
  createWorkerLoop: vi.fn((opts: WorkerLoopOptions) => {
    captured.opts = opts
    return { kick: kickFn, stop: stopFn }
  }),
}))

vi.mock('./topics/fetchJobDetails.js', () => ({
  drain: vi.fn(() => Promise.resolve({ processed: 0, failed: 0 })),
}))

import { startDetailsWorker } from './details-worker.js'
import * as fetchJobDetails from './topics/fetchJobDetails.js'

describe('startDetailsWorker', () => {
  const detailFn = vi.fn()
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  beforeEach(() => {
    kickFn.mockClear()
    stopFn.mockClear()
    captured.opts = undefined
  })

  it('returns { kick, stop }', () => {
    const db = createDb(':memory:')
    const worker = startDetailsWorker({ db, log, detailFn })
    expect(worker.kick).toBeDefined()
    expect(worker.stop).toBeDefined()
    db.$client.close()
  })

  it('kick() calls the worker loop kick', () => {
    const db = createDb(':memory:')
    const worker = startDetailsWorker({ db, log, detailFn })

    worker.kick()

    expect(kickFn).toHaveBeenCalledTimes(1)
    db.$client.close()
  })

  it('onEmpty fires the onDrained callback', () => {
    const db = createDb(':memory:')
    const onDrained = vi.fn()
    startDetailsWorker({ db, log, detailFn, onDrained })

    captured.opts?.onEmpty?.()

    expect(onDrained).toHaveBeenCalledOnce()
    db.$client.close()
  })

  it('stop() calls the worker loop stop', () => {
    const db = createDb(':memory:')
    const worker = startDetailsWorker({ db, log, detailFn })

    worker.stop()

    expect(stopFn).toHaveBeenCalledTimes(1)
    db.$client.close()
  })

  it('forwards detailFn to fetchJobDetails.drain', async () => {
    const db = createDb(':memory:')
    startDetailsWorker({ db, log, detailFn })

    await captured.opts?.drain()

    expect(fetchJobDetails.drain).toHaveBeenCalledOnce()
    expect(fetchJobDetails.drain).toHaveBeenCalledWith(db, expect.objectContaining({ detailFn }))
    db.$client.close()
  })
})
