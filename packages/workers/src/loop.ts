/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export interface WorkerLoopOptions {
  drain: () => Promise<{ total: number }>
  onEmpty?: () => void
  log?: { debug?: (obj: object, msg?: string) => void }
}

export interface WorkerLoop {
  kick(): void
  stop(): void
}

export function createWorkerLoop(opts: WorkerLoopOptions): WorkerLoop {
  let running = false
  let pending = false
  let stopped = false

  function runPass(): Promise<void> {
    return (async () => {
      try {
        while (!stopped) {
          const { total } = await opts.drain()
          opts.log?.debug?.({ total }, 'worker pass')
          if (total === 0) break
        }
        if (!stopped) opts.onEmpty?.()
      } finally {
        running = false
        if (!stopped && pending) {
          pending = false
          void runPass()
        }
      }
    })()
  }

  function kick(): void {
    if (stopped) return
    if (running) {
      pending = true
      return
    }
    running = true
    void runPass()
  }

  function stop(): void {
    stopped = true
    pending = false
  }

  return { kick, stop }
}
