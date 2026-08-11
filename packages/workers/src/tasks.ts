/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { tasks, type DB, type Task } from 'db'
import { and, eq, isNull, sql } from 'drizzle-orm'

export function enqueueTask(db: DB, { topic }: { topic: string }): number {
  const { id } = db.insert(tasks).values({ topic }).returning({ id: tasks.id }).get()
  return id
}

export function attachInputDoc(db: DB, taskId: number, docId: string): void {
  db.update(tasks).set({ inputDocId: docId }).where(eq(tasks.id, taskId)).run()
}

export function selectPendingTasks(db: DB, topic: string, limit?: number): Task[] {
  const query = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.topic, topic), isNull(tasks.completedAt)))
    .orderBy(tasks.id)

  if (limit !== undefined) return query.limit(limit).all()
  return query.all()
}

export function completeTask(db: DB, taskId: number, result: object): void {
  db.update(tasks)
    .set({ result: JSON.stringify(result), completedAt: sql`(CURRENT_TIMESTAMP)`, errorMessage: null })
    .where(eq(tasks.id, taskId))
    .run()
}

// Failures are terminal: the row leaves the pending set (completed_at is set)
// so a drain pass terminates. Retrying failed rows is deferred to a later
// iteration.
export function failTask(db: DB, taskId: number, message: string): void {
  db.update(tasks)
    .set({ errorMessage: message, completedAt: sql`(CURRENT_TIMESTAMP)` })
    .where(eq(tasks.id, taskId))
    .run()
}
