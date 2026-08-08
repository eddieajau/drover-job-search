/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export { createDb } from './connection.js'
export { analysisQueue, crawls, facts, jobSignals, jobs, queries, signalRules, TABLE_DDL } from './schema.js'
export type { AnalysisQueue, Crawl, Fact, Job, JobSignal, Query, SignalRule } from './schema.js'
export type { DB } from './connection.js'
