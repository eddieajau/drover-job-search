/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { runCrawl } from './commands/crawl.js'
import { runCrawlDetails } from './commands/crawlDetails.js'
import { runInference } from './commands/inference.js'
import { runRunSignalRules } from './commands/runSignalRules.js'

const [subcommand, ...args] = process.argv.slice(2)

async function main(): Promise<void> {
  switch (subcommand) {
    case 'crawl':
      return runCrawl(args)
    case 'crawl:details':
      return runCrawlDetails(args)
    case 'inference':
      return runInference(args)
    case 'run-signal-rules':
      return runRunSignalRules(args)
    default:
      console.error('unknown subcommand:', subcommand)
      process.exit(2)
  }
}

main().catch(err => {
  console.error('fatal error:', err)
  process.exit(1)
})
