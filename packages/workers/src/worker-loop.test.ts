/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createWorkerLoop } from './worker-loop.js'

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('createWorkerLoop', () => {
  let drain: ReturnType<typeof vi.fn>
  let onEmpty: ReturnType<typeof vi.fn>
  let loop: ReturnType<typeof createWorkerLoop>

  beforeEach(() => {
    drain = vi.fn()
    onEmpty = vi.fn()
  })

  afterEach(() => {
    loop.stop()
  })

  it('drains until empty then fires onEmpty', async () => {
    drain.mockResolvedValueOnce({ total: 3 }).mockResolvedValueOnce({ total: 2 }).mockResolvedValueOnce({ total: 0 })
    loop = createWorkerLoop({ drain, onEmpty })

    loop.kick()
    await flush()

    expect(drain).toHaveBeenCalledTimes(3)
    expect(onEmpty).toHaveBeenCalledTimes(1)
  })

  it('two synchronous kicks never run concurrent drains and re-run once', async () => {
    drain.mockResolvedValue({ total: 0 })
    loop = createWorkerLoop({ drain, onEmpty })

    loop.kick()
    loop.kick()
    await flush()

    expect(drain).toHaveBeenCalledTimes(2)
    expect(onEmpty).toHaveBeenCalledTimes(2)
  })

  it('a kick while a pass is in flight re-runs once after it empties', async () => {
    drain.mockResolvedValue({ total: 0 })
    loop = createWorkerLoop({ drain, onEmpty })

    loop.kick()
    await flush()
    expect(drain).toHaveBeenCalledTimes(1)
    expect(onEmpty).toHaveBeenCalledTimes(1)

    loop.kick()
    await flush()
    expect(drain).toHaveBeenCalledTimes(2)
    expect(onEmpty).toHaveBeenCalledTimes(2)
  })

  it('stop detaches so later kicks do nothing', async () => {
    drain.mockResolvedValue({ total: 0 })
    loop = createWorkerLoop({ drain, onEmpty })

    loop.stop()
    loop.kick()
    await flush()

    expect(drain).not.toHaveBeenCalled()
    expect(onEmpty).not.toHaveBeenCalled()
  })

  it('stop mid-pass skips onEmpty and the pending re-run', async () => {
    drain.mockResolvedValue({ total: 0 })
    loop = createWorkerLoop({ drain, onEmpty })

    loop.kick()
    loop.kick()
    loop.stop()
    await flush()

    expect(drain).toHaveBeenCalledTimes(1)
    expect(onEmpty).not.toHaveBeenCalled()
  })
})
