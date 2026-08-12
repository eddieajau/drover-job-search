/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { DB, SignalRule } from 'db'
import { jobSignals, jobs, signalRules } from 'db'
import { eq } from 'drizzle-orm'

export type { SignalRule } from 'db'

export class DbService {
  readonly #db: DB

  constructor(db: DB) {
    this.#db = db
  }

  deleteSignalsByRuleId(ruleId: number): void {
    this.#db.delete(jobSignals).where(eq(jobSignals.ruleId, ruleId)).run()
  }

  getAllJobs(): { id: number; title: string; companyName: string | null; description: string | null }[] {
    return this.#db.select().from(jobs).all()
  }

  getAllEnabledRules(): SignalRule[] {
    return this.#db.select().from(signalRules).where(eq(signalRules.enabled, true)).all()
  }

  insertJobSignal(signal: {
    jobId: number
    ruleId: number
    source: string
    signalType: string
    score: number
    metadata: string
  }): void {
    this.#db.insert(jobSignals).values(signal).run()
  }
}
