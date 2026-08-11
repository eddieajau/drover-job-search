/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export * as fetchJobDetails from './topics/fetchJobDetails.js'
export * as rankJobDetails from './topics/rankJobDetails.js'
export * as ollama from './clients/ollama.js'
export { createWorkerLoop } from './loop.js'
export type { WorkerLoop, WorkerLoopOptions } from './loop.js'
export { toMarkdown } from './lib/markdown.js'
export { sanitise } from './lib/sanitise.js'
export type { AnalysisTopic, PendingRow } from './queue.js'
export { createPublisher } from './publisher.js'
export type { Publisher } from './publisher.js'
export { createConsumer } from './consumer.js'
export type { Consumer } from './consumer.js'
export { attachInputDoc, completeTask, enqueueTask, failTask, selectPendingTasks } from './tasks.js'
export type { Task } from 'db'
export { createFetchJobDetailsConsumer } from './topics/fetchJobDetails.js'
export { createRankConsumer } from './topics/rankJobDetails.js'
