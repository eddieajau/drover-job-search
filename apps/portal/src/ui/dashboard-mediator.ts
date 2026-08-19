/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { ApplicationsChart } from '../shared/types.js'
import { DashboardPage } from './pages/dashboard/index.js'

let registered = false

export function initDashboardMediator(): void {
  if (registered) {
    return
  }
  registered = true
  window.addEventListener('dashboard-page:ready', handleReady)
  const page = document.querySelector<DashboardPage>('dashboard-page')
  if (page) {
    void refreshChart(page)
  }
}

export function _resetDashboardMediatorForTesting(): void {
  if (registered) {
    window.removeEventListener('dashboard-page:ready', handleReady)
  }
  registered = false
}

async function handleReady(event: Event): Promise<void> {
  // Use the event target rather than re-querying the document.
  // Re-querying hits a happy-dom bug where a prior `querySelector('dashboard-page')`
  // that returned null (no page in the DOM yet) is cached and served again here,
  // even after the page has connected and dispatched this event.
  if (event.target instanceof DashboardPage) {
    await refreshChart(event.target)
  }
}

async function refreshChart(page: DashboardPage): Promise<void> {
  try {
    const response = await fetch('/api/applications/chart')
    if (!response.ok) {
      throw new Error('Failed to load chart')
    }
    page.setData((await response.json()) as ApplicationsChart)
  } catch {
    page.setData({ days: [] })
  }
}
