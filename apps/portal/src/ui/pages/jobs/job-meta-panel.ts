/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { JobNote, JobSignal } from '../../../shared/types.js'
import { escapeHtml as esc } from '../../escape.js'
import type { JobWithStatus } from '../../jobs-view.js'
import type { EvalWhy } from './ai-eval-box.js'
import './ai-eval-box.js'
import './job-note-dialog.js'
import { todayIso } from './job-note-dialog.js'

export interface JobMetaPanelEventMap {
  'job-meta:status': CustomEvent<{ jobId: number; status: string }>
  'job-meta:open': CustomEvent<{ url: string }>
  'job-meta:flag': CustomEvent<{ jobId: number; providerJobId: string }>
  'job-meta:rank': CustomEvent<{ jobId: number; providerJobId: string }>
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  discovered: 'Discovered',
  applied: 'Applied',
  interviewing: 'Interviewing',
  skipped: 'Skipped',
  blocked: 'Blocked',
  declined: 'Declined',
  unsuccessful: 'Unsuccessful',
  successful: 'Successful',
  evaluated: 'Evaluated',
}

const NOTE_KIND_LABELS: Record<string, string> = {
  applied: 'Applied',
  interviewing: 'Interviewing',
  declined: 'Declined',
  unsuccessful: 'Unsuccessful',
  successful: 'Successful',
  general: 'Note',
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function evalWhyFromSignals(signals: JobSignal[]): EvalWhy | null {
  const summary = signals.find(s => s.signalType === 'eval_summary')
  if (!summary?.metadata) {
    return null
  }
  const dealbreakers = signals
    .filter(s => s.signalType === 'dealbreaker' && s.metadata?.reason)
    .map(s => String(s.metadata!.reason))
  return {
    strengths: toStringList(summary.metadata.strengths),
    gaps: toStringList(summary.metadata.gaps),
    dealbreakers,
  }
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
  #notes: JobNote[] = []
  #events: Array<{ status: string; occurredAt: string; actor: string | null; note: string | null }> = []
  #queued = false
  #activeTab: 'details' | 'history' | 'notes' = 'details'
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  showJob(job: JobWithStatus | null, signals: JobSignal[], queued: boolean): void {
    if (job?.id !== this.#job?.id) {
      this.#notes = []
      this.#events = []
      if (job) {
        this.fetchEvents(job.id)
      }
    }
    this.#job = job
    this.#signals = signals
    this.#queued = queued
    this.render()
  }

  setNotes(notes: JobNote[]): void {
    this.#notes = notes
    this.render()
  }

  private async fetchEvents(jobId: number): Promise<void> {
    try {
      const res = await fetch(`/api/jobs/${jobId}/events`)
      if (res.ok) {
        const data = await res.json()
        this.#events = Array.isArray(data) ? data : []
      }
    } catch {
      // Silently ignore — history tab shows empty state
    }
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
    if (action === 'tab') {
      const tab = button.dataset.tab as 'details' | 'history' | 'notes'
      if (tab) {
        this.#activeTab = tab
        this.render()
      }
      return
    }
    if (action === 'expand') {
      const noteId = button.dataset.note ?? ''
      const container = this.querySelector<HTMLElement>(`[data-note-id="${noteId}"]`)
      if (!container) return

      const preview = container.querySelector<HTMLElement>('.note-preview')
      const full = container.querySelector<HTMLElement>('.note-full')
      const btn = button

      if (preview && full) {
        const isExpanded = !full.hidden
        preview.hidden = !isExpanded
        full.hidden = isExpanded
        btn.textContent = isExpanded ? 'Show more' : 'Show less'
      }
      return
    }
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
    if (action === 'note') {
      const jobId = this.#job?.id
      const kind = (button.dataset.kind ?? 'general') as JobNote['kind']
      if (jobId) {
        const mode = kind === 'general' ? 'note' : 'status'
        this.querySelector('job-note-dialog')?.open({
          jobId,
          kind,
          date: kind === 'general' ? undefined : todayIso(),
          mode,
        })
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
      return
    }
    if (action === 'rank') {
      if (button.disabled) {
        return
      }
      const providerJobId = button.dataset.jobId ?? ''
      const jobId = this.#job?.id
      if (providerJobId && jobId) {
        this.dispatchEvent(
          new CustomEvent('job-meta:rank', {
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
    const hasDescription = !!job.descriptionHtml
    const flagDisabled = this.#queued ? 'disabled' : ''
    const flagLabel = this.#queued ? 'Queued' : hasDescription ? 'Refetch Details' : 'Fetch Details'
    const rankDisabled = ''

    const signalsHtml = this.#signals
      .filter(s => s.signalType !== 'eval_summary')
      .map(s => {
        const scoreClass = s.score >= 0 ? 'pos' : 'neg'
        const dimension = s.metadata?.dimension
        const dimensionLabel =
          typeof dimension === 'string' ? `<span class="signal-dimension">${esc(dimension)}</span>` : ''
        return `<div class="signal-row st-${esc(s.signalType)}">
          <span class="chip chip-${esc(s.signalType)}">${esc(s.signalType)}</span>
          ${dimensionLabel}
          <span class="signal-score ${scoreClass}">${s.score}</span>
        </div>`
      })
      .join('')

    const TRUNCATE_LENGTH = 120

    const notesHtml = this.#notes
      .map(note => {
        const kindLabel = NOTE_KIND_LABELS[note.kind] ?? note.kind
        const isLong = note.note.length > TRUNCATE_LENGTH
        const preview = isLong ? note.note.slice(0, TRUNCATE_LENGTH) + '…' : note.note
        const noteId = `note-${note.id}`
        return `<div class="note-row">
          <span class="chip chip-${esc(note.kind)}">${esc(kindLabel)}</span>
          <div class="note-text" data-note-id="${esc(noteId)}">
            <span class="note-preview">${esc(preview)}</span>
            ${
              isLong
                ? `<span class="note-full" hidden>${esc(note.note)}</span>
            <button class="note-expand" type="button" data-action="expand" data-note="${esc(noteId)}">Show more</button>`
                : ''
            }
          </div>
          <div class="note-date">${esc(note.createdAt)}</div>
        </div>`
      })
      .join('')

    const eventsHtml = (Array.isArray(this.#events) ? this.#events : [])
      .map(event => {
        const statusLabel = STATUS_LABELS[event.status] ?? event.status
        const actorLabel = event.actor ? ` by ${esc(event.actor)}` : ''
        const noteHtml = event.note ? `<div class="event-note">${esc(event.note)}</div>` : ''
        return `<div class="event-row">
          <span class="chip chip-${esc(event.status)}">${esc(statusLabel)}</span>
          <span class="event-date">${esc(event.occurredAt)}${actorLabel}</span>
          ${noteHtml}
        </div>`
      })
      .join('')

    const detailsActive = this.#activeTab === 'details'
    const historyActive = this.#activeTab === 'history'
    const notesActive = this.#activeTab === 'notes'

    this.innerHTML = `
      <aside class="meta-panel">
        <nav class="meta-tabs" role="tablist">
          <button class="meta-tab" role="tab" aria-selected="${detailsActive}" data-action="tab" data-tab="details">Details</button>
          <button class="meta-tab" role="tab" aria-selected="${historyActive}" data-action="tab" data-tab="history">History</button>
          <button class="meta-tab" role="tab" aria-selected="${notesActive}" data-action="tab" data-tab="notes">Notes (${this.#notes.length})</button>
        </nav>
        ${
          detailsActive
            ? `
          <div class="meta-section">
            <div class="meta-label">Status</div>
            <span class="chip chip-${esc(job._status)}">${esc(statusLabel)}</span>
          </div>
          <div class="meta-section actions">
            <button class="btn btn-primary btn-block" type="button" data-action="note" data-kind="applied">Mark applied</button>
            <button class="btn btn-block" type="button" data-action="note" data-kind="interviewing">Mark interviewing</button>
            <button class="btn btn-block" type="button" data-action="note" data-kind="declined">Mark declined</button>
            <button class="btn btn-block" type="button" data-action="note" data-kind="unsuccessful">Mark unsuccessful</button>
            <button class="btn btn-block" type="button" data-action="note" data-kind="successful">Mark successful</button>
            <button class="btn btn-block" type="button" data-action="note" data-kind="general">Add note</button>
            <button class="btn btn-block" type="button" data-action="status" data-status="skipped">Skip</button>
            <button class="btn btn-block" type="button" data-action="open" data-url="${esc(job.url)}">Open LinkedIn</button>
          </div>
          <div class="meta-section">
            <div class="meta-label-row">
              <div class="meta-label">AI Evaluation</div>
              <button class="btn btn-sm" type="button" data-action="rank" data-job-id="${esc(job.providerJobId)}" ${rankDisabled}>Re-rank</button>
            </div>
            <ai-eval-box${evalData.verdict ? ` verdict="${esc(evalData.verdict)}"` : ''}${evalData.score ? ` score="${esc(evalData.score)}"` : ''}${evalData.why ? ` why="${esc(evalData.why)}"` : ''}${evalData.gated ? ' gated' : ''}${evalData.urgent ? ' urgent' : ''}></ai-eval-box>
          </div>
          <div class="meta-section">
            <div class="meta-label">Signals</div>
            ${signalsHtml}
          </div>
          <div class="meta-section actions">
            <button class="btn btn-block" type="button" data-action="flag" data-job-id="${esc(job.providerJobId)}" ${flagDisabled}>${flagLabel}</button>
          </div>
        `
            : ''
        }
        ${
          historyActive
            ? `
          <div class="meta-section">
            <div class="meta-label">History</div>
            ${eventsHtml || '<p class="meta-empty">No history yet</p>'}
          </div>
        `
            : ''
        }
        ${
          notesActive
            ? `
          <div class="meta-section">
            <div class="meta-label">Notes</div>
            ${notesHtml || '<p class="meta-empty">No notes yet</p>'}
          </div>
        `
            : ''
        }
        <job-note-dialog></job-note-dialog>
      </aside>
    `

    if (detailsActive) {
      this.querySelector('ai-eval-box')?.setWhy(evalWhyFromSignals(this.#signals))
    }
  }
}

customElements.define('job-meta-panel', JobMetaPanel)

declare global {
  interface HTMLElementTagNameMap {
    'job-meta-panel': JobMetaPanel
  }
}
