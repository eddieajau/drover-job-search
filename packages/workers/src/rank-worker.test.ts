/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { createDb } from 'db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkerLoopOptions } from './worker-loop.js'

const { kickFn, stopFn, captured } = vi.hoisted(() => ({
  kickFn: vi.fn(),
  stopFn: vi.fn(),
  captured: { opts: undefined as WorkerLoopOptions | undefined },
}))

vi.mock('./worker-loop.js', () => ({
  createWorkerLoop: vi.fn((opts: WorkerLoopOptions) => {
    captured.opts = opts
    return { kick: kickFn, stop: stopFn }
  }),
}))

const mockClient = { generate: vi.fn() }
vi.mock('./ollama.js', () => ({
  createOllamaClient: vi.fn(() => mockClient),
}))

vi.mock('./rank-job-details.js', () => ({
  drain: vi.fn(() => Promise.resolve({ written: 0, skipped: 0 })),
}))

import { createOllamaClient } from './ollama.js'
import * as rankJobDetails from './rank-job-details.js'
import { startRankWorker } from './rank-worker.js'

describe('startRankWorker', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  beforeEach(() => {
    kickFn.mockClear()
    stopFn.mockClear()
    captured.opts = undefined
    vi.mocked(createOllamaClient).mockClear()
  })

  it('returns { kick, stop }', () => {
    const db = createDb(':memory:')
    const worker = startRankWorker({ db, log })
    expect(worker.kick).toBeDefined()
    expect(worker.stop).toBeDefined()
    db.$client.close()
  })

  it('kick() calls the worker loop kick', () => {
    const db = createDb(':memory:')
    const worker = startRankWorker({ db, log })

    worker.kick()

    expect(kickFn).toHaveBeenCalledTimes(1)
    db.$client.close()
  })

  it('stop() calls the worker loop stop', () => {
    const db = createDb(':memory:')
    const worker = startRankWorker({ db, log })

    worker.stop()

    expect(stopFn).toHaveBeenCalledTimes(1)
    db.$client.close()
  })

  it('builds the ollama client from supplied base URL and model', () => {
    const db = createDb(':memory:')
    startRankWorker({ db, log, ollamaBaseUrl: 'http://custom:1234', ollamaModel: 'mistral' })

    expect(createOllamaClient).toHaveBeenCalledOnce()
    expect(createOllamaClient).toHaveBeenCalledWith('http://custom:1234', 'mistral', log)
    db.$client.close()
  })

  it('forwards the ollama client to rankJobDetails.drain', async () => {
    const db = createDb(':memory:')
    startRankWorker({ db, log, ollamaBaseUrl: 'http://custom:1234', ollamaModel: 'mistral' })

    await captured.opts?.drain()

    expect(rankJobDetails.drain).toHaveBeenCalledOnce()
    expect(rankJobDetails.drain).toHaveBeenCalledWith(db, expect.objectContaining({ client: mockClient }))
    db.$client.close()
  })
})
