/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import './ui/elements/app-shell.js'
import { initJobsMediator } from './ui/jobs-mediator.js'
import { initQueriesMediator } from './ui/queries-mediator.js'
import { initSignalsMediator } from './ui/signals-mediator.js'
import { initThemeMediator } from './ui/theme-mediator.js'

initThemeMediator()
initJobsMediator()
initQueriesMediator()
initSignalsMediator()
