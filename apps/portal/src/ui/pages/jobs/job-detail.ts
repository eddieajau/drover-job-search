/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { JobStatus } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'
import type { JobWithStatus } from '../../jobs-view.js'

export interface JobDetailEventMap {
  'job-detail:status': CustomEvent<{ jobId: string; status: JobStatus['status'] }>
}

export class JobDetail extends HTMLElement {
  #job: JobWithStatus | null = null
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  showJob(job: JobWithStatus | null): void {
    this.#job = job
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
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!button) {
      return
    }
    if (button.dataset.action === 'open') {
      window.open(button.dataset.url ?? '', '_blank')
      return
    }
    const jobId = button.dataset.jobId ?? ''
    const status = button.dataset.status as JobStatus['status'] | undefined
    if (jobId && status) {
      this.dispatchEvent(
        new CustomEvent('job-detail:status', {
          bubbles: true,
          composed: true,
          detail: { jobId, status },
        })
      )
    }
  }

  render(): void {
    if (!this.#job) {
      this.innerHTML = '<div class="detail-empty">Select a job to view details</div>'
      return
    }
    const job = this.#job
    const status = job._status
    this.innerHTML = `
      <div class="detail-header">
        <h2>${esc(job.title)}</h2>
        <div class="company">${esc(job.company)}</div>
        <div class="meta">
          <span>${esc(job.location)}</span>
          <span>Posted ${esc(job.date || 'unknown')}</span>
          <span class="priority-badge p${job.priority}">P${job.priority}</span>
          <span>${esc(job.category)}</span>
          ${status !== 'new' ? `<span>${esc(status)}</span>` : ''}
        </div>
      </div>
      <div class="detail-actions">
        <button type="button" class="btn applied" data-action="status" data-status="applied" data-job-id="${esc(job.id)}">Mark Applied</button>
        <button type="button" class="btn skipped" data-action="status" data-status="skipped" data-job-id="${esc(job.id)}">Skip</button>
        <button type="button" class="btn" data-action="open" data-url="${esc(job.url)}">Open LinkedIn</button>
        ${status !== 'new' ? `<button type="button" class="btn" data-action="status" data-status="new" data-job-id="${esc(job.id)}">Mark New</button>` : ''}
      </div>
      <div class="detail-description">
        ${job.description ? esc(job.description) : '<em>No description in search results.</em>'}
      </div>
    `
  }
}

customElements.define('job-detail', JobDetail)

declare global {
  interface HTMLElementTagNameMap {
    'job-detail': JobDetail
  }
}
