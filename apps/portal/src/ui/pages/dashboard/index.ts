/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { ApplicationsChart as ApplicationsChartData } from '../../../shared/types.js'
import './applications-chart.js'

export interface DashboardPageEventMap {
  'dashboard-page:ready': CustomEvent<void>
}

export class DashboardPage extends HTMLElement {
  #mounted = false

  connectedCallback(): void {
    if (this.#mounted) return
    this.#mounted = true
    this.render()
    this.dispatchEvent(new CustomEvent('dashboard-page:ready', { bubbles: true, composed: true }))
  }

  setData(chart: ApplicationsChartData | null): void {
    const el = this.querySelector<HTMLElementTagNameMap['applications-chart']>('applications-chart')
    if (el) {
      el.setData(chart)
    }
  }

  render(): void {
    this.innerHTML = `
      <main class="page">
        <div class="page-head">
          <h1>Dashboard</h1>
        </div>
        <div class="panel">
          <applications-chart></applications-chart>
        </div>
      </main>
    `
  }
}

customElements.define('dashboard-page', DashboardPage)

declare global {
  interface HTMLElementTagNameMap {
    'dashboard-page': DashboardPage
  }
}
