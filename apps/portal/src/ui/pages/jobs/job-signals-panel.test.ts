/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { JobSignal } from '../../../shared/types.js'
import './job-signals-panel.js'
import type { JobSignalsPanel } from './job-signals-panel.js'

function signal(overrides: Partial<JobSignal> = {}): JobSignal {
  return {
    id: 1,
    jobId: 1,
    ruleId: 1,
    source: 'regex_title',
    signalType: 'senior',
    score: 10,
    metadata: { why: 'Contains senior keyword' },
    createdAt: '2026-08-05 00:00:00',
    ...overrides,
  }
}

describe('job-signals-panel', () => {
  let el: JobSignalsPanel

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('job-signals-panel')
    document.body.appendChild(el)
  })

  it('renders an empty prompt when no job is selected', () => {
    el.showSignals(null, [], false)
    expect(el.querySelector('.signals-empty')?.textContent).toBe('Select a job to view signals')
  })

  it('renders signals for a job', () => {
    el.showSignals('job-1', [signal()], false)
    expect(el.querySelector('.signal-source')?.textContent).toBe('regex_title')
    expect(el.querySelector('.signal-type')?.textContent).toBe('senior')
    expect(el.querySelector('.signal-score')?.textContent).toBe('10')
    expect(el.querySelector('.signal-why')?.textContent).toBe('Contains senior keyword')
  })

  it('shows a "No signals recorded" message when there are no signals', () => {
    el.showSignals('job-1', [], false)
    expect(el.querySelector('.signals-none')?.textContent).toBe('No signals recorded.')
  })

  it('renders the flag button enabled when not queued', () => {
    el.showSignals('job-1', [], false)
    const btn = el.querySelector<HTMLButtonElement>('[data-action="flag"]')
    expect(btn).not.toBeNull()
    expect(btn?.disabled).toBe(false)
    expect(btn?.textContent).toBe('Flag for deep analysis')
  })

  it('renders the flag button disabled when already queued', () => {
    el.showSignals('job-1', [], true)
    const btn = el.querySelector<HTMLButtonElement>('[data-action="flag"]')
    expect(btn?.disabled).toBe(true)
    expect(btn?.textContent).toBe('Queued for analysis')
  })

  it('dispatches job-signals-panel:flag when the flag button is clicked', () => {
    el.showSignals('job-1', [], false)
    let receivedId = ''
    el.addEventListener('job-signals-panel:flag', event => {
      receivedId = (event as CustomEvent<{ providerJobId: string }>).detail.providerJobId
    })
    el.querySelector<HTMLButtonElement>('[data-action="flag"]')?.click()
    expect(receivedId).toBe('job-1')
  })
})
