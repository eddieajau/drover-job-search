# Crawler

CLI that crawls LinkedIn for each enabled query and stores the resulting job cards in the SQLite database.

## How it works

For every enabled row in the `queries` table, the crawler:

1. Picks a search window via the provider's `selectJobage()` (see [Window selection](#window-selection)).
2. Runs the LinkedIn search (`pages: 10`) using the query's saved options (`location`, `workType`, `jobType` from `query_options`).
3. Inserts the returned job cards into the `jobs` table. Inserts dedupe on the `(provider, provider_job_id)` unique index, so re-crawling is idempotent.
4. Appends a row to the `crawls` table recording the run: window used, jobs found, and jobs actually inserted.

Only successful runs are logged — a run that throws (e.g. LinkedIn rate limiting) writes nothing, so a failed crawl can never shrink the next window.

## Window selection

- No prior crawl record for the query → **14-day** window (first crawl).
- Otherwise the anchor is the most recent `crawls.crawled_at` for that query (falling back to `MAX(jobs.created_at)` for rows that predate the crawl log). The provider then picks the smallest window bucket that overlaps the anchor — see the [LinkedIn provider README](../packages/provider-linkedin/README.md).

Because the window is scoped per query through the crawl log, a query that is disabled for a while and re-enabled resumes with a window large enough to cover the gap, instead of assuming a fresh start.

## Running

```bash
npm start -w apps/crawler
# or from the repo root
npm run crawl
```

Requires a `.env` at the repo root with `DATABASE` pointing at the SQLite file. All tables (including `crawls`) are created automatically on connect.
