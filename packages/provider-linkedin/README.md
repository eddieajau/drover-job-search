# LinkedIn Provider

Search and detail extraction for LinkedIn's public `jobs-guest` endpoints. No authentication required.

Adapted from [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search/tree/main/.agents/skills/linkedin-search/cli) by [MadsLorentzen](https://github.com/MadsLorentzen), licensed under the [MIT License](./LICENSE).

Changes from the original:

- Removed Bun-specific imports (`bun:test`, shebang)
- Functions return data instead of writing to stdout
- Adapted for Node.js / tsx execution
