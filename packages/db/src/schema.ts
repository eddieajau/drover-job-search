/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { sqliteTable, text, integer, real, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core'
import { sql, type InferSelectModel } from 'drizzle-orm'

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
    status: text('status').notNull().default('discovered'),

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
    uniqueIndex('uq_provider_job').on(table.provider, table.providerJobId),
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
    check('check_status', sql`${table.status} IN ('discovered', 'bookmarked', 'applied', 'skipped', 'archived')`),
    check('check_processed_by', sql`${table.processedBy} IN ('human', 'ai', 'system') OR ${table.processedBy} IS NULL`),
  ]
)

export type Query = InferSelectModel<typeof queries>
export type Job = InferSelectModel<typeof jobs>

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
        status IN ('discovered', 'bookmarked', 'applied', 'skipped', 'archived')
    ) DEFAULT 'discovered',
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
`
