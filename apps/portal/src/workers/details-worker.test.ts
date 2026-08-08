/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { EventEmitter } from 'node:events'

import { createDb } from 'db'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkerLoopOptions } from 'workers'

import type { BusEvents } from '../bus.js'
import { startDetailsWorker, type StopFn } from './details-worker.js'

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
  fetchJobDetails: { drain: vi.fn() },
}))

vi.mock('provider-linkedin', () => ({ detail: vi.fn() }))

describe('details worker wiring', () => {
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
    stop = startDetailsWorker(bus, db, log)
  })

  afterEach(() => {
    stop()
    db.$client.close()
  })

  it('creates a worker loop over the fetch-job-details drain', () => {
    expect(captured.opts).toBeDefined()
  })

  it('wires a flagged event to loop.kick', () => {
    bus.emit('flagged', { jobId: 7 })

    expect(kickFn).toHaveBeenCalledTimes(1)
  })

  it('emits descriptions-ready with jobId 0 when a pass empties', () => {
    const received: { jobId: number }[] = []
    bus.on('descriptions-ready', payload => {
      received.push(payload)
    })

    captured.opts?.onEmpty?.()

    expect(received).toEqual([{ jobId: 0 }])
  })

  it('detaches the flagged listener when stopped', () => {
    stop()
    bus.emit('flagged', { jobId: 7 })

    expect(kickFn).not.toHaveBeenCalled()
  })

  it('returns a stop fn that stops the loop', () => {
    stop()

    expect(stopFn).toHaveBeenCalledTimes(1)
  })
})
