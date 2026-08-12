/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { sql, type InferSelectModel } from 'drizzle-orm'
import { sqliteTable, text, integer, real, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core'

export const queries = sqliteTable(
  'queries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider: text('provider').notNull().default('linkedin'),
    queryText: text('query_text').notNull(),
    queryOptions: text('query_options'),
    enabled: integer('enabled', { mode: 'boolean' }).default(true),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  table => [
    check('check_query_options', sql`${table.queryOptions} IS NULL OR json_valid(${table.queryOptions})`),
    check('check_enabled', sql`${table.enabled} IN (0, 1)`),
  ]
)

export const crawls = sqliteTable(
  'crawls',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    queryId: integer('query_id')
      .notNull()
      .references(() => queries.id, { onDelete: 'cascade' }),
    windowDays: integer('window_days').notNull(),
    foundCount: integer('found_count').notNull().default(0),
    insertedCount: integer('inserted_count').notNull().default(0),
    crawledAt: text('crawled_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  table => [index('idx_crawls_query_id').on(table.queryId)]
)

export const jobs = sqliteTable(
  'jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),

    // Provider Identity
    provider: text('provider').notNull().default('linkedin'),
    providerJobId: text('provider_job_id').notNull(),

    // Listing Metadata
    title: text('title').notNull(),
    companyName: text('company_name').notNull(),
    url: text('url').notNull(),
    location: text('location').notNull(),
    workplaceType: text('workplace_type'),
    employmentType: text('employment_type'),
    postedAt: text('posted_at'),
    description: text('description'),

    // Standardised Salary Metrics
    salaryMin: real('salary_min'),
    salaryMax: real('salary_max'),
    salaryCurrency: text('salary_currency'),
    salaryPeriod: text('salary_period'),
    isSalaryEstimated: integer('is_salary_estimated').notNull().default(0),
    salaryRaw: text('salary_raw'),

    // Workflow & Application State Tracking
    category: text('category').notNull().default('General'),
    priority: integer('priority').notNull().default(0),
    status: text('status').notNull().default('new'),

    // Actor & Decision Tracking
    processedBy: text('processed_by'),
    skipReason: text('skip_reason'),

    // Timestamps
    createdAt: text('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    appliedAt: text('applied_at'),
    skippedAt: text('skipped_at'),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  table => [
    index('uq_provider_job').on(table.provider, table.providerJobId),
    index('idx_jobs_provider_id').on(table.provider, table.providerJobId),

    // Check Constraints
    check(
      'check_workplace_type',
      sql`${table.workplaceType} IN ('onsite', 'hybrid', 'remote') OR ${table.workplaceType} IS NULL`
    ),
    check(
      'check_employment_type',
      sql`${table.employmentType} IN ('full-time', 'part-time', 'contract', 'temporary', 'casual', 'other') OR ${table.employmentType} IS NULL`
    ),
    check('check_salary_currency', sql`length(${table.salaryCurrency}) = 3 OR ${table.salaryCurrency} IS NULL`),
    check(
      'check_salary_period',
      sql`${table.salaryPeriod} IN ('hourly', 'daily', 'weekly', 'monthly', 'annual') OR ${table.salaryPeriod} IS NULL`
    ),
    check('check_is_salary_estimated', sql`${table.isSalaryEstimated} IN (0, 1)`),
    check('check_status', sql`${table.status} IN ('new', 'discovered', 'applied', 'skipped')`),
    check('check_processed_by', sql`${table.processedBy} IN ('human', 'ai', 'system') OR ${table.processedBy} IS NULL`),
  ]
)

export const signalRules = sqliteTable(
  'signal_rules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ruleName: text('rule_name').notNull(),
    ruleCategory: text('rule_category').notNull(),
    pattern: text('pattern').notNull(),
    signalType: text('signal_type').notNull().default('skill_match'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  table => [
    uniqueIndex('uq_signal_rules_rule_name').on(table.ruleName),
    check('check_rule_category', sql`${table.ruleCategory} IN ('regex_title', 'regex_company', 'regex_description')`),
    check('check_rule_signal_type', sql`${table.signalType} IN ('dealbreaker', 'skill_match', 'company_match')`),
    check('check_rule_enabled', sql`${table.enabled} IN (0, 1)`),
  ]
)

export const jobSignals = sqliteTable(
  'job_signals',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jobId: integer('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    ruleId: integer('rule_id').references(() => signalRules.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    signalType: text('signal_type').notNull(),
    score: integer('score').notNull(),
    metadata: text('metadata'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  table => [
    uniqueIndex('uq_job_signals_job_rule_source').on(table.jobId, table.ruleId, table.source),
    index('idx_job_signals_job_id').on(table.jobId),
    index('idx_job_signals_rule_id').on(table.ruleId),
    check(
      'check_signal_source',
      sql`${table.source} IN ('regex_title', 'regex_company', 'regex_description', 'manual_review', 'llm_deep_eval')`
    ),
    check('check_signal_metadata', sql`${table.metadata} IS NULL OR json_valid(${table.metadata})`),
  ]
)

export const analysisQueue = sqliteTable(
  'analysis_queue',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jobId: integer('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(),
    errorMessage: text('error_message'),
    queuedAt: text('queued_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    completedAt: text('completed_at'),
  },
  table => [
    index('idx_analysis_queue_job_id_topic').on(table.jobId, table.topic),
    check('check_queue_topic', sql`${table.topic} IN ('fetch_job_details', 'rank')`),
  ]
)

export const facts = sqliteTable(
  'facts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    category: text('category').notNull(),
    label: text('label').notNull(),
    detail: text('detail'),
    evidenceType: text('evidence_type'),
    startedAt: text('started_at'),
    endedAt: text('ended_at'),
    period: text('period'),
    confidence: text('confidence').notNull().default('stated'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  table => [
    index('idx_facts_category').on(table.category),
    index('idx_facts_active').on(table.active),
    check(
      'check_fact_category',
      sql`${table.category} IN ('skill', 'role', 'precedent_story', 'gap', 'credential', 'principle', 'constraint')`
    ),
    check(
      'check_fact_evidence_type',
      sql`${table.evidenceType} IN ('fast_pivot', 'genuine_precedent', 'genuine_gap') OR ${table.evidenceType} IS NULL`
    ),
    check('check_fact_confidence', sql`${table.confidence} IN ('stated', 'inferred', 'stretch')`),
    check('check_fact_active', sql`${table.active} IN (0, 1)`),
  ]
)

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
})

export const tasks = sqliteTable(
  'tasks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    topic: text('topic').notNull(),
    inputDocId: text('input_doc_id'),
    result: text('result'),
    errorMessage: text('error_message'),
    queuedAt: text('queued_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    completedAt: text('completed_at'),
  },
  table => [
    check('check_task_topic', sql`${table.topic} IN ('slice_resume')`),
    check('check_task_result', sql`${table.result} IS NULL OR json_valid(${table.result})`),
  ]
)

export type Query = InferSelectModel<typeof queries>
export type Job = InferSelectModel<typeof jobs>
export type Crawl = InferSelectModel<typeof crawls>
export type SignalRule = InferSelectModel<typeof signalRules>
export type JobSignal = InferSelectModel<typeof jobSignals>
export type AnalysisQueue = InferSelectModel<typeof analysisQueue>
export type Fact = InferSelectModel<typeof facts>
export type Document = InferSelectModel<typeof documents>
export type Task = InferSelectModel<typeof tasks>

export const TABLE_DDL = `
CREATE TABLE IF NOT EXISTS queries (
    id INTEGER PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'linkedin',
    query_text TEXT NOT NULL,
    query_options TEXT CHECK (query_options IS NULL OR json_valid(query_options)),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'linkedin',
    provider_job_id TEXT NOT NULL,
    title TEXT NOT NULL,
    company_name TEXT NOT NULL,
    url TEXT NOT NULL,
    location TEXT NOT NULL,
    workplace_type TEXT CHECK (
        workplace_type IN ('onsite', 'hybrid', 'remote') OR workplace_type IS NULL
    ),
    employment_type TEXT CHECK (
        employment_type IN ('full-time', 'part-time', 'contract', 'temporary', 'casual', 'other') OR employment_type IS NULL
    ),
    posted_at TEXT,
    description TEXT,
    salary_min REAL,
    salary_max REAL,
    salary_currency TEXT CHECK (length(salary_currency) = 3 OR salary_currency IS NULL),
    salary_period TEXT CHECK (
        salary_period IN ('hourly', 'daily', 'weekly', 'monthly', 'annual') OR salary_period IS NULL
    ),
    is_salary_estimated INTEGER NOT NULL DEFAULT 0 CHECK (
        is_salary_estimated IN (0, 1)
    ),
    salary_raw TEXT,
    category TEXT NOT NULL DEFAULT 'General',
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (
        status IN ('new', 'discovered', 'applied', 'skipped')
    ) DEFAULT 'new',
    processed_by TEXT CHECK (
        processed_by IN ('human', 'ai', 'system') OR processed_by IS NULL
    ),
    skip_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    applied_at TEXT,
    skipped_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT uq_provider_job UNIQUE (provider, provider_job_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_provider_id ON jobs(provider, provider_job_id);

CREATE TABLE IF NOT EXISTS crawls (
    id INTEGER PRIMARY KEY,
    query_id INTEGER NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
    window_days INTEGER NOT NULL,
    found_count INTEGER NOT NULL DEFAULT 0,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    crawled_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_crawls_query_id ON crawls(query_id);

CREATE TABLE IF NOT EXISTS signal_rules (
    id INTEGER PRIMARY KEY,
    rule_name TEXT NOT NULL,
    rule_category TEXT NOT NULL CHECK (
        rule_category IN ('regex_title', 'regex_company', 'regex_description')
    ),
    pattern TEXT NOT NULL,
    signal_type TEXT NOT NULL DEFAULT 'skill_match' CHECK (
        signal_type IN ('dealbreaker', 'skill_match', 'company_match')
    ),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT uq_signal_rules_rule_name UNIQUE (rule_name)
);

CREATE TABLE IF NOT EXISTS job_signals (
    id INTEGER PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    rule_id INTEGER REFERENCES signal_rules(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (
        source IN ('regex_title', 'regex_company', 'regex_description', 'manual_review', 'llm_deep_eval')
    ),
    signal_type TEXT NOT NULL,
    score INTEGER NOT NULL,
    metadata TEXT CHECK (metadata IS NULL OR json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT uq_job_signals_job_rule_source UNIQUE (job_id, rule_id, source)
);

CREATE INDEX IF NOT EXISTS idx_job_signals_job_id ON job_signals(job_id);
CREATE INDEX IF NOT EXISTS idx_job_signals_rule_id ON job_signals(rule_id);

CREATE TABLE IF NOT EXISTS analysis_queue (
    id INTEGER PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    error_message TEXT,
    queued_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    completed_at TEXT,
    CONSTRAINT check_queue_topic CHECK (topic IN ('fetch_job_details', 'rank'))
);

CREATE INDEX IF NOT EXISTS idx_analysis_queue_job_id_topic ON analysis_queue(job_id, topic);

CREATE TABLE IF NOT EXISTS facts (
    id INTEGER PRIMARY KEY,
    category TEXT NOT NULL CHECK (
        category IN ('skill', 'role', 'precedent_story', 'gap', 'credential', 'principle', 'constraint')
    ),
    label TEXT NOT NULL,
    detail TEXT,
    evidence_type TEXT CHECK (
        evidence_type IN ('fast_pivot', 'genuine_precedent', 'genuine_gap') OR evidence_type IS NULL
    ),
    started_at TEXT,
    ended_at TEXT,
    period TEXT,
    confidence TEXT NOT NULL DEFAULT 'stated' CHECK (
        confidence IN ('stated', 'inferred', 'stretch')
    ),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);
CREATE INDEX IF NOT EXISTS idx_facts_active ON facts(active);

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    topic TEXT NOT NULL,
    input_doc_id TEXT,
    result TEXT CHECK (result IS NULL OR json_valid(result)),
    error_message TEXT,
    queued_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    completed_at TEXT,
    CONSTRAINT check_task_topic CHECK (topic IN ('slice_resume'))
);
`
