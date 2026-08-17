/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { escapeHtml as esc } from '../../escape.js'
import { relativeAge } from './posted-age.js'

export interface JobCardEventMap {
  'job-card:select': CustomEvent<{ jobId: number; providerJobId: string; provider: string }>
  'job-card:flag': CustomEvent<{ jobId: number; providerJobId: string }>
  'job-card:status': CustomEvent<{ jobId: number; providerJobId: string; status: string }>
}

type JobCardAttribute =
  | 'job-id'
  | 'provider-job-id'
  | 'provider'
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
  | 'skipped'
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
    'skipped',
    'has-description',
  ]

  #jobId = 0
  #providerJobId = ''
  #provider = ''
  #title = ''
  #company = ''
  #location = ''
  #posted = ''
  #score: number | undefined = undefined
  #gated = false
  #active = false
  #seen = false
  #queued = false
  #skipped = false
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
      case 'provider':
        this.#provider = newValue ?? ''
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
      case 'skipped':
        this.#skipped = newValue !== null
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
    if (actionTarget?.dataset.action === 'yes') {
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
        detail: { jobId: this.#jobId, providerJobId: this.#providerJobId, provider: this.#provider },
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
            detail: { jobId: this.#jobId, providerJobId: this.#providerJobId, provider: this.#provider },
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
    const blockedChip = this.#gated ? '<span class="card-chip-blocked">Blocked</span>' : ''
    const chipsHtml = blockedChip || scoreHtml ? `<div class="card-chips">${scoreHtml}${blockedChip}</div>` : ''
    const docIcon = this.#hasDescription
      ? '<svg class="has-desc-icon" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L9 1.5z"/><path d="M9 1.5V5.5h4"/><path d="M6 8.5h4M6 11h2"/></svg>'
      : '<svg class="no-desc-icon" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L9 1.5z"/><path d="M9 1.5V5.5h4"/></svg>'

    const triSwitch = `<span class="tri-switch" role="group" aria-label="Triage job">
          <button class="tri-yes" type="button" data-action="yes" aria-pressed="${this.#queued}">Yes</button>
          <button class="tri-no" type="button" data-action="skip" aria-pressed="${this.#skipped}">No</button>
        </span>`

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
          ${triSwitch}
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
