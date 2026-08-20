/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { ApplicationsChart as ApplicationsChartData } from '../../../shared/types.js'
import './applications-chart.js'

const STORAGE_KEY = 'dashboard-days'
const DEFAULT_DAYS = 14

export interface DashboardPageEventMap {
  'dashboard-page:ready': CustomEvent<void>
  'dashboard-range:change': CustomEvent<{ days: number }>
}

export class DashboardPage extends HTMLElement {
  #mounted = false
  #abort = new AbortController()

  connectedCallback(): void {
    if (this.#mounted) return
    this.#mounted = true
    this.render()
    this.setupEventListeners()
    this.dispatchEvent(new CustomEvent('dashboard-page:ready', { bubbles: true, composed: true }))
  }

  disconnectedCallback(): void {
    this.#abort.abort()
  }

  setData(chart: ApplicationsChartData | null): void {
    const el = this.querySelector<HTMLElementTagNameMap['applications-chart']>('applications-chart')
    if (el) {
      el.setData(chart)
    }
  }

  get rangeDays(): number {
    const sel = this.querySelector<HTMLSelectElement>('.page-range')
    return sel ? Number(sel.value) : DEFAULT_DAYS
  }

  render(): void {
    this.innerHTML = `
      <main class="page">
        <div class="page-head">
          <h1>Dashboard</h1>
          <span class="page-sub">${this.#formatDate(new Date())}</span>
          <select class="page-range btn" aria-label="Date range">
            <option value="7">Last 7 days</option>
            <option value="14" selected>Last 14 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>
        <div class="dash-grid">
          <section class="panel widget span-8" id="chart">
            <applications-chart></applications-chart>
          </section>
        </div>
      </main>
    `
  }

  setupEventListeners(): void {
    const opts = { signal: this.#abort.signal }
    const sel = this.querySelector<HTMLSelectElement>('.page-range')
    if (sel) {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) sel.value = stored
      sel.addEventListener(
        'change',
        () => {
          sessionStorage.setItem(STORAGE_KEY, sel.value)
          this.dispatchEvent(
            new CustomEvent('dashboard-range:change', {
              detail: { days: Number(sel.value) },
              bubbles: true,
              composed: true,
            })
          )
        },
        opts
      )
    }
  }

  #formatDate(d: Date): string {
    return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
}

customElements.define('dashboard-page', DashboardPage)

declare global {
  interface HTMLElementTagNameMap {
    'dashboard-page': DashboardPage
  }
}
