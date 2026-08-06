import {
  createDb,
  jobSignals,
  jobs,
  queries,
  signalRules,
  type DB,
  type Job,
  type JobSignal,
  type Query,
  type SignalRule,
} from 'db'

import { SIGNAL_MANUAL, SIGNAL_TITLE_MATCH } from './ids.js'
import { JOB1, JOB2 } from './jobs.js'
import { RULE_JAVA, RULE_RECRUITER } from './rules.js'

export interface SeedJob {
  providerJobId: string
  title: string
  companyName: string
  url: string
  location: string
  postedAt?: string | null
  description?: string | null
}

export interface SeedRule {
  ruleName: string
  ruleCategory: string
  pattern: string
  signalType?: string
  scoreModifier?: number
  enabled?: boolean
}

export interface SeedSignal {
  jobId: number
  ruleId?: number | null
  source: string
  signalType: string
  score: number
  metadata?: string | null
}

export interface SeedQuery {
  provider?: string
  queryText: string
  queryOptions?: string | null
  enabled?: boolean
}

export interface SeedDatabaseOptions {
  signals?: boolean
}

export function createTestDb(): DB {
  return createDb(':memory:')
}

export function seedJob(db: DB, input: SeedJob): Job {
  return db.insert(jobs).values(input).returning().get()
}

export function seedRule(db: DB, input: SeedRule): SignalRule {
  return db.insert(signalRules).values(input).returning().get()
}

export function seedSignal(db: DB, input: SeedSignal): JobSignal {
  return db.insert(jobSignals).values(input).returning().get()
}

export function seedQuery(db: DB, input: SeedQuery): Query {
  return db.insert(queries).values(input).returning().get()
}

export function seedDatabase(db: DB, opts: SeedDatabaseOptions = {}): DB {
  const jobOne = seedJob(db, JOB1)
  const jobTwo = seedJob(db, JOB2)

  const ruleJava = seedRule(db, RULE_JAVA)
  const ruleRecruiter = seedRule(db, RULE_RECRUITER)

  if (opts.signals !== false) {
    seedSignal(db, {
      jobId: jobOne.id,
      ruleId: ruleJava.id,
      source: SIGNAL_TITLE_MATCH,
      signalType: 'skill_match',
      score: 5,
    })
    seedSignal(db, {
      jobId: jobTwo.id,
      ruleId: ruleRecruiter.id,
      source: SIGNAL_MANUAL,
      signalType: 'company_match',
      score: -10,
    })
  }

  return db
}
