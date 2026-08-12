/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { escapeHtml as esc } from '../../escape.js'
import type { JobWithStatus } from '../../jobs-view.js'
import './job-card.js'
import type { JobCard } from './job-card.js'

export interface JobListEventMap {
  'job-list:select': CustomEvent<{ jobId: number; providerJobId: string }>
  'job-list:status': CustomEvent<{ jobId: number; status: string }>
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
    const opts = { signal: this.#abort.signal }
    this.addEventListener('job-card:select', this.#onCardSelect as EventListener, opts)
    this.addEventListener('job-card:status', this.#onCardStatus as EventListener, opts)
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onCardSelect = (event: Event): void => {
    const { jobId, providerJobId } = (event as CustomEvent<{ jobId: number; providerJobId: string }>).detail
    this.dispatchEvent(
      new CustomEvent('job-list:select', {
        bubbles: true,
        composed: true,
        detail: { jobId, providerJobId },
      })
    )
  }

  #onCardStatus = (event: Event): void => {
    const { jobId, status } = (event as CustomEvent<{ jobId: number; status: string }>).detail
    this.dispatchEvent(
      new CustomEvent('job-list:status', {
        bubbles: true,
        composed: true,
        detail: { jobId, status },
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

    this.replaceChildren(
      ...this.#state.jobs.map(job => {
        const card = document.createElement('job-card') as JobCard
        card.setAttribute('job-id', String(job.id))
        card.setAttribute('provider-job-id', job.providerJobId)
        card.setAttribute('title', job.title)
        card.setAttribute('company', job.companyName)
        card.setAttribute('location', job.location)
        card.setAttribute('posted', job.postedAt ?? '')
        card.setAttribute('priority', String(job.priority))
        if (job.netScore !== undefined) {
          card.setAttribute('score', String(job.netScore))
        }
        if (job.gated) {
          card.setAttribute('gated', '')
        }
        if (job.queued) {
          card.setAttribute('queued', '')
        }
        if (job._status === 'skipped') {
          card.setAttribute('skipped', '')
        }
        if (job.id === this.#state.selectedId) {
          card.setAttribute('active', '')
        }
        if (job._status !== 'new') {
          card.setAttribute('seen', '')
        }
        if (job.descriptionHtml !== null) {
          card.setAttribute('has-description', '')
        }
        return card
      })
    )
  }
}

customElements.define('job-list', JobList)

declare global {
  interface HTMLElementTagNameMap {
    'job-list': JobList
  }
}
