/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { ApplicationsChart as ApplicationsChartData, DashboardSummary } from '../../../shared/types.js'
import './applications-chart.js'
import './attention-list.js'
import './pipeline-funnel.js'
import type { QueueHealthData } from './queue-health.js'
import './queue-health.js'
import './stat-card.js'

const DEFAULT_DAYS = 14

export interface DashboardPageEventMap {
  'dashboard-page:ready': CustomEvent<void>
  'dashboard-range:change': CustomEvent<{ days: number }>
}

export class DashboardPage extends HTMLElement {
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
    this.dispatchEvent(new CustomEvent('dashboard-page:ready', { bubbles: true, composed: true }))
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  get rangeDays(): number {
    const sel = this.querySelector<HTMLSelectElement>('.page-range')
    return sel ? Number(sel.value) : DEFAULT_DAYS
  }

  setDays(days: number): void {
    const sel = this.querySelector<HTMLSelectElement>('.page-range')
    if (sel && Array.from(sel.options).some(option => option.value === String(days))) {
      sel.value = String(days)
    }
  }

  setChart(chart: ApplicationsChartData | null): void {
    const el = this.querySelector<HTMLElementTagNameMap['applications-chart']>('applications-chart')
    if (el) {
      el.setData(chart)
    }
  }

  setSummary(summary: DashboardSummary | null): void {
    const days = this.rangeDays
    const applied = summary?.applied
    this.querySelector<HTMLElementTagNameMap['stat-card']>('#stat-applied stat-card')?.setData({
      label: `Applied · ${days}d`,
      value: applied?.count ?? '—',
      note: `vs prior ${days} days`,
      delta:
        applied && applied.delta !== 0
          ? { value: Math.abs(applied.delta), direction: applied.delta > 0 ? 'up' : 'down' }
          : undefined,
    })
    const inFlight = summary?.inFlight
    this.querySelector<HTMLElementTagNameMap['stat-card']>('#stat-inflight stat-card')?.setData({
      label: 'In flight',
      value: inFlight ? inFlight.applied + inFlight.interviewing : '—',
      note: inFlight ? `${inFlight.applied} applied · ${inFlight.interviewing} interviewing` : undefined,
    })
    this.querySelector<HTMLElementTagNameMap['stat-card']>('#stat-rate stat-card')?.setData({
      label: 'Interview rate',
      value: summary ? `${summary.interviewRate}%` : '—',
      note: `applied → interviewing, ${days}d`,
    })

    this.querySelector<HTMLElementTagNameMap['pipeline-funnel']>('pipeline-funnel')?.setData(summary?.pipeline ?? null)
    this.querySelector<HTMLElementTagNameMap['attention-list']>('attention-list')?.setData(summary?.attention ?? null)
  }

  setQueueHealth(data: QueueHealthData | null): void {
    const el = this.querySelector<HTMLElementTagNameMap['queue-health']>('queue-health')
    if (el) {
      el.setData(data)
    }
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
          <section class="panel widget span-3" id="stat-applied">
            <stat-card></stat-card>
          </section>
          <section class="panel widget span-3" id="stat-inflight">
            <stat-card></stat-card>
          </section>
          <section class="panel widget span-3" id="stat-rate">
            <stat-card></stat-card>
          </section>
          <section class="panel widget span-8" id="chart">
            <applications-chart></applications-chart>
          </section>
          <section class="panel widget span-4" id="pipeline">
            <pipeline-funnel></pipeline-funnel>
          </section>
          <section class="panel widget span-7" id="attention">
            <attention-list></attention-list>
          </section>
          <section class="panel widget span-5" id="queue-health">
            <queue-health></queue-health>
          </section>
        </div>
      </main>
    `
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    const sel = this.querySelector<HTMLSelectElement>('.page-range')
    if (sel) {
      sel.addEventListener(
        'change',
        () => {
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

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
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
