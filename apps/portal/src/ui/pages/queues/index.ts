/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { QueueSummaryResponse, QueueSummaryRow } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'
import { relativeAge } from '../jobs/posted-age.js'

export interface QueuesPageEventMap {
  'queues-page:ready': CustomEvent<void>
}

function emptySummary(): QueueSummaryResponse {
  return { pending: { fetch_job_details: 0, rank: 0 }, done: 0, total: 0, recent: [] }
}

export class QueuesPage extends HTMLElement {
  #summary: QueueSummaryResponse = emptySummary()

  connectedCallback(): void {
    this.render()
    this.dispatchEvent(new CustomEvent('queues-page:ready', { bubbles: true, composed: true }))
  }

  setSummary(summary: QueueSummaryResponse): void {
    this.#summary = summary ?? emptySummary()
    this.#updateHead()
    this.#renderRows()
  }

  #updateHead(): void {
    const pending = this.#summary.pending.fetch_job_details + this.#summary.pending.rank
    const el = this.querySelector<HTMLSpanElement>('.page-count')
    if (el) {
      el.textContent = `${pending} pending · ${this.#summary.done} done`
    }
  }

  #renderRows(): void {
    const list = this.querySelector<HTMLUListElement>('.queue-list')
    if (!list) {
      return
    }
    if (this.#summary.recent.length === 0) {
      list.innerHTML = '<li class="queue-row queue-empty">Nothing queued yet.</li>'
      return
    }
    list.innerHTML = this.#summary.recent.map(rowTemplate).join('')
  }

  render(): void {
    this.innerHTML = `
      <main class="page">
        <div class="page-head">
          <h1>Queues</h1>
          <span class="page-count"></span>
        </div>
        <div class="panel">
          <ul class="queue-list"></ul>
        </div>
      </main>
    `
    this.#updateHead()
    this.#renderRows()
  }
}

function rowTemplate(row: QueueSummaryRow): string {
  const doneClass = row.completedAt ? ' is-done' : ''
  const badgeClass = row.stage === 'rank' ? 'badge stage-rank' : 'badge'
  const doneTick = row.completedAt ? '<span class="queue-done">done ✓</span>' : ''
  return `
    <li class="queue-row${doneClass}">
      <div class="queue-main">
        <span class="queue-title">${esc(row.title)}</span>
        <span class="queue-company">${esc(row.companyName)}</span>
      </div>
      <span class="${badgeClass}">${esc(row.stage)}</span>
      <span class="queue-age">${esc(relativeAge(row.queuedAt))}</span>
      ${doneTick}
    </li>
  `
}

customElements.define('queues-page', QueuesPage)

declare global {
  interface HTMLElementTagNameMap {
    'queues-page': QueuesPage
  }
}
