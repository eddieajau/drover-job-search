/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { ApplicationsChart } from '../shared/types.js'
import type { DashboardPage } from './pages/dashboard/index.js'

let registered = false

export function initDashboardMediator(): void {
  if (registered) {
    return
  }
  registered = true
  window.addEventListener('dashboard-page:ready', handleReady)
}

export function _resetDashboardMediatorForTesting(): void {
  if (registered) {
    window.removeEventListener('dashboard-page:ready', handleReady)
  }
  registered = false
}

async function handleReady(): Promise<void> {
  const page = document.querySelector<DashboardPage>('dashboard-page')
  if (!page) return
  await refreshChart(page)
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
