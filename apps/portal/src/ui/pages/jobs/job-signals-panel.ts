/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { JobSignal } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'

export interface JobSignalsPanelEventMap {
  'job-signals-panel:flag': CustomEvent<{ providerJobId: string }>
}

export class JobSignalsPanel extends HTMLElement {
  #signals: JobSignal[] = []
  #providerJobId: string | null = null
  #queued = false
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  showSignals(providerJobId: string | null, signals: JobSignal[], queued: boolean): void {
    this.#providerJobId = providerJobId
    this.#signals = signals
    this.#queued = queued
    this.render()
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    this.addEventListener('click', this.#onClick, { signal: this.#abort.signal })
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onClick = (event: MouseEvent): void => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action="flag"]')
    if (!btn || btn.disabled) {
      return
    }
    const providerJobId = btn.dataset.jobId ?? ''
    if (!providerJobId) {
      return
    }
    this.dispatchEvent(
      new CustomEvent('job-signals-panel:flag', {
        bubbles: true,
        composed: true,
        detail: { providerJobId },
      })
    )
  }

  render(): void {
    if (!this.#providerJobId) {
      this.innerHTML = '<div class="signals-empty">Select a job to view signals</div>'
      return
    }

    const flagDisabled = this.#queued ? 'disabled' : ''
    const flagLabel = this.#queued ? 'Queued for analysis' : 'Flag for deep analysis'

    this.innerHTML = `
      <div class="signals-panel">
        <h3 class="signals-heading">Signals</h3>
        ${this.#signals.length === 0 ? '<p class="signals-none">No signals recorded.</p>' : ''}
        <ul class="signals-list">
          ${this.#signals
            .map(
              s => `
            <li class="signal-row">
              <span class="signal-source">${esc(s.source)}</span>
              <span class="signal-type">${esc(s.signalType)}</span>
              <span class="signal-score">${s.score}</span>
              ${s.metadata ? `<span class="signal-why">${esc(String(s.metadata['why'] ?? ''))}</span>` : ''}
            </li>`
            )
            .join('')}
        </ul>
        <button type="button" class="btn flag-btn" data-action="flag" data-job-id="${esc(this.#providerJobId)}" ${flagDisabled}>${flagLabel}</button>
      </div>
    `
  }
}

customElements.define('job-signals-panel', JobSignalsPanel)

declare global {
  interface HTMLElementTagNameMap {
    'job-signals-panel': JobSignalsPanel
  }
}
