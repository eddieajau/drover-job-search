/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { escapeHtml as esc } from '../../escape.js'
import { relativeAge } from './posted-age.js'

export interface JobCardEventMap {
  'job-card:select': CustomEvent<{ jobId: number; providerJobId: string }>
  'job-card:flag': CustomEvent<{ jobId: number; providerJobId: string }>
  'job-card:status': CustomEvent<{ jobId: number; providerJobId: string; status: string }>
}

type JobCardAttribute =
  | 'job-id'
  | 'provider-job-id'
  | 'title'
  | 'company'
  | 'location'
  | 'posted'
  | 'priority'
  | 'score'
  | 'gated'
  | 'active'
  | 'seen'
  | 'queued'
  | 'has-description'

export class JobCard extends HTMLElement {
  static observedAttributes: JobCardAttribute[] = [
    'job-id',
    'provider-job-id',
    'title',
    'company',
    'location',
    'posted',
    'priority',
    'score',
    'gated',
    'active',
    'seen',
    'queued',
    'has-description',
  ]

  #jobId = 0
  #providerJobId = ''
  #title = ''
  #company = ''
  #location = ''
  #posted = ''
  #score: number | undefined = undefined
  #gated = false
  #active = false
  #seen = false
  #queued = false
  #hasDescription = false
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.setAttribute('tabindex', '0')
    this.setAttribute('role', 'row')
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  attributeChangedCallback(name: JobCardAttribute, _oldValue: string | null, newValue: string | null): void {
    switch (name) {
      case 'job-id':
        this.#jobId = Number(newValue)
        break
      case 'provider-job-id':
        this.#providerJobId = newValue ?? ''
        break
      case 'title':
        this.#title = newValue ?? ''
        break
      case 'company':
        this.#company = newValue ?? ''
        break
      case 'location':
        this.#location = newValue ?? ''
        break
      case 'posted':
        this.#posted = newValue ?? ''
        break
      case 'score':
        this.#score = newValue !== null ? Number(newValue) : undefined
        break
      case 'gated':
        this.#gated = newValue !== null
        break
      case 'active':
        this.#active = newValue !== null
        break
      case 'seen':
        this.#seen = newValue !== null
        break
      case 'queued':
        this.#queued = newValue !== null
        break
      case 'has-description':
        this.#hasDescription = newValue !== null
        break
    }
    if (this.isConnected) {
      this.render()
    }
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('click', this.#onClick, opts)
    this.addEventListener('keydown', this.#onKeydown, opts)
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onClick = (event: MouseEvent): void => {
    const actionTarget = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (actionTarget?.dataset.action === 'flag') {
      this.dispatchEvent(
        new CustomEvent<JobCardEventMap['job-card:flag'] extends CustomEvent<infer D> ? D : never>('job-card:flag', {
          bubbles: true,
          composed: true,
          detail: { jobId: this.#jobId, providerJobId: this.#providerJobId },
        })
      )
      return
    }
    if (actionTarget?.dataset.action === 'skip') {
      this.dispatchEvent(
        new CustomEvent<JobCardEventMap['job-card:status'] extends CustomEvent<infer D> ? D : never>(
          'job-card:status',
          {
            bubbles: true,
            composed: true,
            detail: { jobId: this.#jobId, providerJobId: this.#providerJobId, status: 'skipped' },
          }
        )
      )
      return
    }
    this.dispatchEvent(
      new CustomEvent<JobCardEventMap['job-card:select'] extends CustomEvent<infer D> ? D : never>('job-card:select', {
        bubbles: true,
        composed: true,
        detail: { jobId: this.#jobId, providerJobId: this.#providerJobId },
      })
    )
  }

  #onKeydown = (event: KeyboardEvent): void => {
    if ((event.target as HTMLElement).closest('[data-action]')) {
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      this.dispatchEvent(
        new CustomEvent<JobCardEventMap['job-card:select'] extends CustomEvent<infer D> ? D : never>(
          'job-card:select',
          {
            bubbles: true,
            composed: true,
            detail: { jobId: this.#jobId, providerJobId: this.#providerJobId },
          }
        )
      )
    }
  }

  render(): void {
    const scoreHtml =
      this.#score !== undefined
        ? `<span class="score ${(this.#score ?? 0) >= 50 ? 'score-high' : 'score-mid'}">${esc(`${this.#score}`)}</span>`
        : ''
    const chipsHtml =
      this.#gated || this.#score !== undefined
        ? `<div class="card-chips">${this.#gated ? '<span class="card-chip-blocked">Blocked</span>' : scoreHtml}</div>`
        : ''

    const docIcon = this.#hasDescription
      ? '<svg class="has-desc-icon" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L9 1.5z"/><path d="M9 1.5V5.5h4"/><path d="M6 8.5h4M6 11h2"/></svg>'
      : '<svg class="no-desc-icon" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L9 1.5z"/><path d="M9 1.5V5.5h4"/></svg>'

    const flagIcon = this.#queued
      ? '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M3 1v14"/><path d="M3 2.5h9l-2.1 3 2.1 3H3z"/></svg>'
      : '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 1v14"/><path d="M3 2.5h9l-2.1 3 2.1 3H3z"/></svg>'

    const skipIcon =
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M3 3.5l6.5 4.5L3 12.5z"/><path d="M11.5 3.5h1.5v9h-1.5z"/></svg>'

    const classes = ['job-card']
    if (this.#active) classes.push('active')
    if (!this.#seen) classes.push('unseen')
    if (this.#gated) classes.push('gated')

    const descAttr = this.#hasDescription ? ' has-description' : ''

    this.innerHTML = `
      <div class="${classes.join(' ')}"${descAttr}>
        <div class="job-title">${esc(this.#title)}</div>
        <div class="job-company">${esc(this.#company)}</div>
        ${chipsHtml}
        <div class="job-meta">
          <span class="loc">${esc(this.#location)}</span>
          <span class="posted">${esc(relativeAge(this.#posted))}</span>
          ${docIcon}
          <button class="card-skip" type="button" data-action="skip" aria-label="Skip job">
            ${skipIcon}
          </button>
          <button class="card-flag" type="button" data-action="flag" aria-pressed="${this.#queued}" aria-label="Flag for deep analysis">
            ${flagIcon}
          </button>
        </div>
      </div>
    `
  }
}

customElements.define('job-card', JobCard)

declare global {
  interface HTMLElementTagNameMap {
    'job-card': JobCard
  }
}
