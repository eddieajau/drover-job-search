/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { EventEmitter } from 'node:events'

import { createDb } from 'db'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkerLoopOptions } from 'workers'

import type { BusEvents } from '../bus.js'
import { startRankWorker, type StopFn } from './rank-worker.js'

const { kickFn, stopFn, captured } = vi.hoisted(() => ({
  kickFn: vi.fn(),
  stopFn: vi.fn(),
  captured: { opts: undefined as WorkerLoopOptions | undefined },
}))

vi.mock('workers', () => ({
  createWorkerLoop: vi.fn((opts: WorkerLoopOptions) => {
    captured.opts = opts
    return { kick: kickFn, stop: stopFn }
  }),
  rankJobDetails: {
    drain: vi.fn(),
    createOllamaClient: vi.fn(() => ({ generate: vi.fn() })),
  },
}))

describe('rank worker wiring', () => {
  let bus: EventEmitter<BusEvents>
  let db: ReturnType<typeof createDb>
  let log: ReturnType<typeof vi.fn>
  let stop: StopFn

  beforeEach(() => {
    bus = new EventEmitter<BusEvents>()
    db = createDb(':memory:')
    log = vi.fn()
    kickFn.mockClear()
    stopFn.mockClear()
    captured.opts = undefined
    stop = startRankWorker(bus, db, log)
  })

  afterEach(() => {
    stop()
    db.$client.close()
  })

  it('creates a worker loop over the rank-job-details drain', () => {
    expect(captured.opts).toBeDefined()
  })

  it('wires a descriptions-ready event to loop.kick', () => {
    bus.emit('descriptions-ready', { jobId: 0 })

    expect(kickFn).toHaveBeenCalledTimes(1)
  })

  it('detaches the descriptions-ready listener when stopped', () => {
    stop()
    bus.emit('descriptions-ready', { jobId: 0 })

    expect(kickFn).not.toHaveBeenCalled()
  })

  it('returns a stop fn that stops the loop', () => {
    stop()

    expect(stopFn).toHaveBeenCalledTimes(1)
  })
})
