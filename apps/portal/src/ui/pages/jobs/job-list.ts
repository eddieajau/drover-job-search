/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { JobStatus } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'
import type { JobWithStatus } from '../../jobs-view.js'

export interface JobListEventMap {
  'job-list:select': CustomEvent<{ jobId: number; providerJobId: string }>
  'job-list:status': CustomEvent<{ jobId: number; status: JobStatus['status'] }>
}

export interface JobListState {
  status: 'idle' | 'loading' | 'error' | 'done'
  message: string
  jobs: JobWithStatus[]
  selectedId: number | null
}

export class JobList extends HTMLElement {
  #state: JobListState = { status: 'idle', message: '', jobs: [], selectedId: null }
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setState(state: JobListState): void {
    this.#state = state
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
    const target = event.target as HTMLElement
    const card = target.closest<HTMLElement>('.card')
    if (!card) {
      return
    }
    const jobId = Number(card.dataset.jobId)
    const providerJobId = card.dataset.providerJobId ?? ''
    const action = target.closest<HTMLButtonElement>('button[data-action]')
    if (action) {
      if (action.dataset.action === 'open') {
        window.open(action.dataset.url ?? '', '_blank')
        return
      }
      const status = action.dataset.status as JobStatus['status'] | undefined
      if (status) {
        this.dispatchEvent(
          new CustomEvent('job-list:status', {
            bubbles: true,
            composed: true,
            detail: { jobId, status },
          })
        )
      }
      return
    }
    this.dispatchEvent(
      new CustomEvent('job-list:select', {
        bubbles: true,
        composed: true,
        detail: { jobId, providerJobId },
      })
    )
  }

  render(): void {
    switch (this.#state.status) {
      case 'idle':
        this.innerHTML = '<div class="loading">Click Search to start</div>'
        return
      case 'loading':
        this.innerHTML = '<div class="loading">Loading...</div>'
        return
      case 'error':
        this.innerHTML = `<div class="load-error">${esc(this.#state.message)}</div>`
        return
      case 'done':
        break
    }

    if (this.#state.jobs.length === 0) {
      this.innerHTML = '<div class="empty-state">No jobs match filters</div>'
      return
    }

    this.innerHTML = this.#state.jobs
      .map(
        job => `
      <div class="card ${job.id === this.#state.selectedId ? 'active' : ''} ${job._status !== 'new' ? 'seen' : ''}" data-job-id="${esc(String(job.id))}" data-provider-job-id="${esc(job.providerJobId)}">
        <div class="card-title">${esc(job.title)}</div>
        <div class="card-company">${esc(job.companyName)}</div>
        <div class="card-meta">
          <span class="priority-badge p${job.priority}">P${job.priority}</span>
          <span>${esc(job.location)}</span>
          <span>${esc(job.postedAt ?? '')}</span>
          ${job._status !== 'new' ? `<span>${esc(job._status)}</span>` : ''}
        </div>
        <div class="card-actions">
          <button type="button" class="btn ${job._status === 'applied' ? 'applied' : ''}" data-action="status" data-status="applied">Applied</button>
          <button type="button" class="btn ${job._status === 'skipped' ? 'skipped' : ''}" data-action="status" data-status="skipped">Skip</button>
          <button type="button" class="btn" data-action="open" data-url="${esc(job.url)}">LinkedIn</button>
        </div>
      </div>`
      )
      .join('')
  }
}

customElements.define('job-list', JobList)

declare global {
  interface HTMLElementTagNameMap {
    'job-list': JobList
  }
}
