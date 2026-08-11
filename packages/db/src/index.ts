/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export { createDb } from './connection.js'
export {
  analysisQueue,
  crawls,
  documents,
  facts,
  jobSignals,
  jobs,
  queries,
  signalRules,
  tasks,
  TABLE_DDL,
} from './schema.js'
export type { AnalysisQueue, Crawl, Document, Fact, Job, JobSignal, Query, SignalRule, Task } from './schema.js'
export type { DB } from './connection.js'
