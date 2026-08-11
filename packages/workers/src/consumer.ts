/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { createWorkerLoop, type WorkerLoopOptions } from './loop.js'

export interface Consumer {
  kick(): void
  stop(): void
}

export interface ConsumerOptions {
  topic: string
  drain: () => Promise<{ total: number }>
  onEmpty?: () => void
  log?: WorkerLoopOptions['log']
}

export function createConsumer(opts: ConsumerOptions): Consumer {
  const loop = createWorkerLoop({
    drain: opts.drain,
    onEmpty: () => {
      opts.log?.debug?.({ topic: opts.topic }, 'consumer drained')
      opts.onEmpty?.()
    },
    log: opts.log,
  })
  return { kick: loop.kick, stop: loop.stop }
}
