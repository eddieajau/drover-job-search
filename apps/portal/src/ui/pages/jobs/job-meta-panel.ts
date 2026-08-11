/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { JobSignal } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'
import type { JobWithStatus } from '../../jobs-view.js'
import type { EvalWhy } from './ai-eval-box.js'
import './ai-eval-box.js'

export interface JobMetaPanelEventMap {
  'job-meta:status': CustomEvent<{ jobId: number; status: string }>
  'job-meta:open': CustomEvent<{ url: string }>
  'job-meta:flag': CustomEvent<{ jobId: number; providerJobId: string }>
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  applied: 'Applied',
  skipped: 'Skipped',
  evaluated: 'Evaluated',
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function evalWhyFromSignals(signals: JobSignal[]): EvalWhy | null {
  const summary = signals.find(s => s.signalType === 'eval_summary')
  if (!summary?.metadata) {
    return null
  }
  return { strengths: toStringList(summary.metadata.strengths), gaps: toStringList(summary.metadata.gaps) }
}

const URGENT_WINDOW_MS = 7 * 86_400_000

function isUrgent(postedAt: string | null, now: Date = new Date()): boolean {
  if (!postedAt) {
    return false
  }
  const posted = new Date(postedAt)
  if (Number.isNaN(posted.getTime())) {
    return false
  }
  return now.getTime() - posted.getTime() <= URGENT_WINDOW_MS
}

function deriveVerdict(job: JobWithStatus): {
  verdict: string
  score: string
  why: string
  gated: boolean
  urgent: boolean
} {
  if (job.gated) {
    return { verdict: 'Auto-skip', score: '', why: 'Blocked by dealbreaker rule.', gated: true, urgent: false }
  }
  if (job.netScore === undefined) {
    return { verdict: '', score: '', why: '', gated: false, urgent: false }
  }
  const score = job.netScore
  let verdict: string
  if (score >= 75) {
    verdict = 'Strong fit'
  } else if (score >= 60) {
    verdict = 'Good fit'
  } else if (score >= 45) {
    verdict = 'Moderate fit'
  } else if (score >= 30) {
    verdict = 'Weak fit'
  } else {
    verdict = 'Poor fit'
  }
  return { verdict, score: String(score), why: '', gated: false, urgent: isUrgent(job.postedAt) }
}

export class JobMetaPanel extends HTMLElement {
  #job: JobWithStatus | null = null
  #signals: JobSignal[] = []
  #queued = false
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  showJob(job: JobWithStatus | null, signals: JobSignal[], queued: boolean): void {
    this.#job = job
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
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!button) {
      return
    }
    const action = button.dataset.action
    if (action === 'status') {
      const jobId = this.#job?.id
      const status = button.dataset.status
      if (jobId && status) {
        this.dispatchEvent(
          new CustomEvent('job-meta:status', {
            bubbles: true,
            composed: true,
            detail: { jobId, status },
          })
        )
      }
      return
    }
    if (action === 'open') {
      const url = button.dataset.url ?? ''
      this.dispatchEvent(
        new CustomEvent('job-meta:open', {
          bubbles: true,
          composed: true,
          detail: { url },
        })
      )
      return
    }
    if (action === 'flag') {
      if (button.disabled) {
        return
      }
      const providerJobId = button.dataset.jobId ?? ''
      const jobId = this.#job?.id
      if (providerJobId && jobId) {
        this.dispatchEvent(
          new CustomEvent('job-meta:flag', {
            bubbles: true,
            composed: true,
            detail: { jobId, providerJobId },
          })
        )
      }
    }
  }

  render(): void {
    if (!this.#job) {
      this.innerHTML = '<p class="meta-empty">Select a job to view signals</p>'
      return
    }

    const job = this.#job
    const statusLabel = STATUS_LABELS[job._status] ?? job._status
    const evalData = deriveVerdict(job)
    const flagDisabled = this.#queued ? 'disabled' : ''
    const flagLabel = this.#queued ? 'Queued' : 'Flag for deep analysis'

    const signalsHtml = this.#signals
      .map(s => {
        const scoreClass = s.score >= 0 ? 'pos' : 'neg'
        const scorePrefix = s.score >= 0 ? '+' : ''
        return `<div class="signal-row">
          <span class="signal-source">${esc(s.source)}</span>
          <span class="chip">${esc(s.signalType)}</span>
          <span class="signal-score ${scoreClass}">${scorePrefix}${s.score}</span>
        </div>`
      })
      .join('')

    this.innerHTML = `
      <aside class="meta-panel">
        <div class="meta-section">
          <div class="meta-label">Status</div>
          <span class="chip">${esc(statusLabel)}</span>
        </div>
        <div class="meta-section actions">
          <button class="btn btn-primary btn-block" type="button" data-action="status" data-status="applied">Mark applied</button>
          <button class="btn btn-block" type="button" data-action="status" data-status="skipped">Skip</button>
          <button class="btn btn-block" type="button" data-action="open" data-url="${esc(job.url)}">Open LinkedIn</button>
        </div>
        <div class="meta-section">
          <div class="meta-label">AI Evaluation</div>
          <ai-eval-box${evalData.verdict ? ` verdict="${esc(evalData.verdict)}"` : ''}${evalData.score ? ` score="${esc(evalData.score)}"` : ''}${evalData.why ? ` why="${esc(evalData.why)}"` : ''}${evalData.gated ? ' gated' : ''}${evalData.urgent ? ' urgent' : ''}></ai-eval-box>
        </div>
        <div class="meta-section">
          <div class="meta-label">Signals</div>
          ${signalsHtml}
          <button class="btn btn-block" type="button" data-action="flag" data-job-id="${esc(job.providerJobId)}" ${flagDisabled}>${flagLabel}</button>
        </div>
      </aside>
    `

    this.querySelector('ai-eval-box')?.setWhy(evalWhyFromSignals(this.#signals))
  }
}

customElements.define('job-meta-panel', JobMetaPanel)

declare global {
  interface HTMLElementTagNameMap {
    'job-meta-panel': JobMetaPanel
  }
}
