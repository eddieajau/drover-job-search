/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it, vi } from 'vitest'

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

import { createConsumer } from './consumer.js'

describe('createConsumer', () => {
  const drain = vi.fn(async () => ({ total: 0 }))

  it('returns { kick, stop } wired to the worker loop', () => {
    const consumer = createConsumer({ topic: 'fetch_job_details', drain })

    consumer.kick()
    consumer.stop()

    expect(kickFn).toHaveBeenCalledTimes(1)
    expect(stopFn).toHaveBeenCalledTimes(1)
  })

  it('forwards drain to the worker loop', () => {
    createConsumer({ topic: 'rank', drain })

    expect(captured.opts?.drain).toBe(drain)
  })

  it('onEmpty fires onDrained and logs the topic', () => {
    const onDrained = vi.fn()
    const log = { debug: vi.fn() }
    createConsumer({ topic: 'rank', drain, onEmpty: onDrained, log })

    captured.opts?.onEmpty?.()

    expect(onDrained).toHaveBeenCalledOnce()
    expect(log.debug).toHaveBeenCalledWith({ topic: 'rank' }, 'consumer drained')
  })
})
