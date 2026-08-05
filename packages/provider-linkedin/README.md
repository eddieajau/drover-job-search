# LinkedIn Provider

Search and detail extraction for LinkedIn's public `jobs-guest` endpoints. No authentication required.

Adapted from [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search/tree/main/.agents/skills/linkedin-search/cli) by [MadsLorentzen](https://github.com/MadsLorentzen), licensed under the [MIT License](./LICENSE).

Changes from the original:

- Removed Bun-specific imports (`bun:test`, shebang)
- Functions return data instead of writing to stdout
- Adapted for Node.js / tsx execution

## Search window

`search()` filters by job age via LinkedIn's `f_TPR` parameter, which accepts a raw number of seconds. LinkedIn's UI exposes discrete buckets, and `selectJobage()` picks from those buckets rather than arbitrary values:

| Bucket (days) | `f_TPR`     |
| ------------- | ----------- |
| 1             | `r86400`    |
| 7             | `r604800`   |
| 30            | `r2592000`  |
| 90            | `r7776000`  |
| 182           | `r15724800` |
| 365           | `r31536000` |

`selectJobage(anchor)` returns the smallest bucket that reaches back far enough to overlap `anchor` (a timestamp):

- **No anchor** → **14 days** (first crawl). 14 is not one of the buckets above — it is sent as a raw `f_TPR` value (`r1209600`) and stays exactly 14 days; it is never rounded up to the 30-day bucket.
- **Otherwise** → the smallest bucket where `bucket ≥ now − anchor`.
- Anchors older than 365 days clamp to **365 days** (LinkedIn's maximum coverage).
- Anchors in the future clamp to **1 day**.

The anchor is expected to be a _local_ timestamp — e.g. the crawler's last `crawls.crawled_at` or a job's `created_at` — never LinkedIn's `posted_at`/card date. LinkedIn labels posting dates loosely, so they should not be treated as reliable.
