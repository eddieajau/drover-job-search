/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { Job, JobSignal } from '../../../shared/types.js'
import type { JobWithStatus } from '../../jobs-view.js'
import './job-meta-panel.js'
import type { JobMetaPanel } from './job-meta-panel.js'

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 1,
    providerJobId: '4445084022',
    title: 'Staff Engineer',
    companyName: 'Acme',
    url: 'https://li/job-1',
    location: 'Brisbane',
    postedAt: '2026-08-05',
    priority: 1,
    category: 'P1',
    descriptionHtml: '<p>Design and build.</p>',
    ...overrides,
  }
}

function signal(overrides: Partial<JobSignal> = {}): JobSignal {
  return {
    id: 1,
    jobId: 1,
    ruleId: 1,
    source: 'regex_title',
    signalType: 'skill_match',
    score: 10,
    createdAt: '2026-08-05 00:00:00',
    ...overrides,
  }
}

describe('job-meta-panel', () => {
  let el: JobMetaPanel

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('job-meta-panel')
    document.body.appendChild(el)
  })

  it('renders empty prompt when job is null', () => {
    el.showJob(null, [], false)
    expect(el.querySelector('.meta-empty')?.textContent).toBe('Select a job to view signals')
  })

  it('renders Status chip, actions, ai-eval-box, signals and flag button for a scored job', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 85 }
    const sigs = [signal({ source: 'regex_title', signalType: 'skill_match', score: 10 })]
    el.showJob(j, sigs, false)

    expect(el.querySelector('.meta-section .chip')?.textContent).toBe('New')

    const buttons = el.querySelectorAll<HTMLButtonElement>('button[data-action]')
    const actions = Array.from(buttons).map(
      b => `${b.dataset.action}:${b.dataset.status ?? b.dataset.url ?? b.dataset.jobId ?? ''}`
    )
    expect(actions).toContain('status:applied')
    expect(actions).toContain('status:skipped')
    expect(actions).toContain('open:https://li/job-1')
    expect(actions).toContain('flag:4445084022')

    const evalBox = el.querySelector('ai-eval-box')
    expect(evalBox).not.toBeNull()
    expect(evalBox?.getAttribute('verdict')).toBe('High match')
    expect(evalBox?.getAttribute('score')).toBe('85')

    const signalRows = el.querySelectorAll('.signal-row')
    expect(signalRows.length).toBe(1)
    expect(signalRows[0].querySelector('.signal-source')?.textContent).toBe('regex_title')
    expect(signalRows[0].querySelector('.signal-score')?.classList.contains('pos')).toBe(true)
    expect(signalRows[0].querySelector('.signal-score')?.textContent).toBe('+10')

    const flagBtn = el.querySelector<HTMLButtonElement>('[data-action="flag"]')
    expect(flagBtn?.disabled).toBe(false)
    expect(flagBtn?.textContent).toBe('Flag for deep analysis')
  })

  it('disables the flag button when queued is true', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], true)
    const flagBtn = el.querySelector<HTMLButtonElement>('[data-action="flag"]')
    expect(flagBtn?.disabled).toBe(true)
    expect(flagBtn?.textContent).toBe('Queued')
  })

  it('dispatches job-meta:status when Skip is clicked', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], false)
    const received = { jobId: 0, status: '' }
    el.addEventListener('job-meta:status', event => {
      const detail = (event as CustomEvent<{ jobId: number; status: string }>).detail
      received.jobId = detail.jobId
      received.status = detail.status
    })
    el.querySelector<HTMLButtonElement>('[data-action="status"][data-status="skipped"]')?.click()
    expect(received).toEqual({ jobId: 1, status: 'skipped' })
  })

  it('dispatches job-meta:flag when the flag button is clicked', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], false)
    let receivedId = ''
    el.addEventListener('job-meta:flag', event => {
      receivedId = (event as CustomEvent<{ providerJobId: string }>).detail.providerJobId
    })
    el.querySelector<HTMLButtonElement>('[data-action="flag"]')?.click()
    expect(receivedId).toBe('4445084022')
  })

  it('renders negative signal scores with neg class', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: -5 }
    const sigs = [signal({ score: -5 })]
    el.showJob(j, sigs, false)
    const scoreEl = el.querySelector('.signal-score')
    expect(scoreEl?.classList.contains('neg')).toBe(true)
    expect(scoreEl?.textContent).toBe('-5')
  })

  it('renders Auto-skip verdict for gated jobs', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 80, gated: true }
    el.showJob(j, [], false)
    const evalBox = el.querySelector('ai-eval-box')
    expect(evalBox?.getAttribute('verdict')).toBe('Auto-skip')
    expect(evalBox?.hasAttribute('gated')).toBe(true)
  })
})
