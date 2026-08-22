/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { QueueSummaryResponse, QueueSummaryRow } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'
import { relativeAge } from '../jobs/posted-age.js'

export interface QueuesPageEventMap {
  'queues-page:ready': CustomEvent<void>
  'queues-page:kick': CustomEvent<{ topic: 'fetch_job_details' | 'rank' }>
  'queues-page:tick': CustomEvent<void>
}

const KICK_ACTIONS: Record<string, 'fetch_job_details' | 'rank'> = {
  'kick-details': 'fetch_job_details',
  'kick-rank': 'rank',
}

function emptySummary(): QueueSummaryResponse {
  return { pending: { fetch_job_details: 0, rank: 0 }, done: 0, failed: 0, total: 0, recent: [] }
}

export class QueuesPage extends HTMLElement {
  #summary: QueueSummaryResponse = emptySummary()
  #abort: AbortController | null = null
  #timer: ReturnType<typeof setInterval> | null = null

  connectedCallback(): void {
    this.render()
    this.#setupListeners()
    this.#startPolling()
    this.dispatchEvent(new CustomEvent('queues-page:ready', { bubbles: true, composed: true }))
  }

  disconnectedCallback(): void {
    this.#cleanup()
  }

  setSummary(summary: QueueSummaryResponse): void {
    this.#summary = summary ?? emptySummary()
    this.#updateHead()
    this.#renderRows()
  }

  setKickBusy(topic: 'fetch_job_details' | 'rank', busy: boolean): void {
    const action = topic === 'fetch_job_details' ? 'kick-details' : 'kick-rank'
    const btn = this.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
    if (!btn) return
    btn.disabled = busy
    btn.setAttribute('aria-busy', String(busy))
  }

  #setupListeners(): void {
    this.#cleanup()
    this.#abort = new AbortController()
    this.addEventListener('click', this.#onClick, { signal: this.#abort.signal })
  }

  #startPolling(): void {
    this.#timer = setInterval(() => {
      this.dispatchEvent(new CustomEvent('queues-page:tick', { bubbles: true, composed: true }))
    }, 5000)
  }

  #cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
    if (this.#timer !== null) {
      clearInterval(this.#timer)
      this.#timer = null
    }
  }

  #onClick = (event: MouseEvent): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
    const action = target?.dataset.action
    if (!action || !(action in KICK_ACTIONS)) return
    const topic = KICK_ACTIONS[action]
    this.dispatchEvent(
      new CustomEvent<QueuesPageEventMap['queues-page:kick'] extends CustomEvent<infer D> ? D : never>(
        'queues-page:kick',
        { bubbles: true, composed: true, detail: { topic } }
      )
    )
  }

  #updateHead(): void {
    const pending = this.#summary.pending.fetch_job_details + this.#summary.pending.rank
    const el = this.querySelector<HTMLSpanElement>('.page-count')
    if (el) {
      let text = `${pending} pending · ${this.#summary.done} done`
      if (this.#summary.failed > 0) {
        text += ` · ${this.#summary.failed} failed`
      }
      el.textContent = text
    }
  }

  #renderRows(): void {
    const list = this.querySelector<HTMLUListElement>('.queue-list')
    if (!list) return
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
          <div class="head-actions">
            <button class="btn" type="button" data-action="kick-details">Run fetch-details</button>
            <button class="btn" type="button" data-action="kick-rank">Run rank</button>
          </div>
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
  const stateClass = row.errorMessage ? ' is-failed' : row.completedAt ? ' is-done' : ''
  const badgeClass = row.topic === 'rank' ? 'badge topic-rank' : 'badge'
  const marker = row.errorMessage
    ? `<span class="queue-failed" title="${esc(row.errorMessage)}">failed ✗</span>`
    : row.completedAt
      ? '<span class="queue-done">done ✓</span>'
      : ''
  return `
    <li class="queue-row${stateClass}">
      <div class="queue-main">
        <span class="queue-title">${esc(row.title)}</span>
        <span class="queue-company">${esc(row.companyName)}</span>
      </div>
      <span class="${badgeClass}">${esc(row.topic)}</span>
      <span class="queue-age">${esc(relativeAge(row.queuedAt))}</span>
      ${marker}
    </li>
  `
}

customElements.define('queues-page', QueuesPage)

declare global {
  interface HTMLElementTagNameMap {
    'queues-page': QueuesPage
  }
}
