/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { escapeHtml as esc } from '../../escape.js'

export interface JobCardEventMap {
  'job-card:select': CustomEvent<{ jobId: number; providerJobId: string }>
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

  #onClick = (_event: MouseEvent): void => {
    this.dispatchEvent(
      new CustomEvent<JobCardEventMap['job-card:select'] extends CustomEvent<infer D> ? D : never>('job-card:select', {
        bubbles: true,
        composed: true,
        detail: { jobId: this.#jobId, providerJobId: this.#providerJobId },
      })
    )
  }

  #onKeydown = (event: KeyboardEvent): void => {
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
    const scoreBand = this.#gated ? 'score-low' : (this.#score ?? 0) >= 50 ? 'score-high' : 'score-mid'
    const scoreLabel = this.#gated
      ? 'auto-skip'
      : this.#score !== undefined
        ? `${this.#score >= 0 ? '+' : ''}${this.#score}`
        : ''

    const hasScore = this.#gated || this.#score !== undefined
    const scoreHtml = hasScore ? `<span class="score ${scoreBand}">${esc(scoreLabel)}</span>` : ''

    const classes = ['job-card']
    if (this.#active) classes.push('active')
    if (!this.#seen) classes.push('unseen')
    if (this.#gated) classes.push('gated')

    this.innerHTML = `
      <div class="${classes.join(' ')}">
        <div class="job-title">${esc(this.#title)}</div>
        <div class="job-company">${esc(this.#company)}</div>
        <div class="job-meta">
          <span class="loc">${esc(this.#location)}</span>
          <span class="posted">${esc(this.#posted)}</span>
          <span class="spacer"></span>
          ${scoreHtml}
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
