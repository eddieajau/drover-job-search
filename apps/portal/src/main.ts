/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import './ui/elements/app-shell.js'
import { initDashboardMediator } from './ui/dashboard-mediator.js'
import { initFactsMediator } from './ui/facts-mediator.js'
import { initImportMediator } from './ui/import-mediator.js'
import { initJobsMediator } from './ui/jobs-mediator.js'
import { initQueriesMediator } from './ui/queries-mediator.js'
import { initQueuesMediator } from './ui/queues-mediator.js'
import { initSignalsMediator } from './ui/signals-mediator.js'
import { initThemeMediator } from './ui/theme-mediator.js'

initThemeMediator()
initJobsMediator()
initQueriesMediator()
initFactsMediator()
initImportMediator()
initQueuesMediator()
initDashboardMediator()
initSignalsMediator()
