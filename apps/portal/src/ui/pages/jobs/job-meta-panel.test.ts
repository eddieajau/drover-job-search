/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { Job, JobNote, JobSignal } from '../../../shared/types.js'
import type { JobWithStatus } from '../../jobs-view.js'
import './job-meta-panel.js'
import type { JobMetaPanel } from './job-meta-panel.js'

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 1,
    provider: 'linkedin',
    providerJobId: '4445084022',
    title: 'Staff Engineer',
    companyName: 'Acme',
    url: 'https://li/job-1',
    location: 'Brisbane',
    postedAt: '2026-08-05',
    priority: 1,
    category: 'P1',
    status: 'new',
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
    expect(el.querySelector('.meta-section .chip')?.classList.contains('chip-new')).toBe(true)

    const buttons = el.querySelectorAll<HTMLButtonElement>('button[data-action]')
    const actions = Array.from(buttons).map(
      b => `${b.dataset.action}:${b.dataset.kind ?? b.dataset.status ?? b.dataset.url ?? b.dataset.jobId ?? ''}`
    )
    expect(actions).toContain('note:applied')
    expect(actions).toContain('note:interviewing')
    expect(actions).toContain('note:declined')
    expect(actions).toContain('note:unsuccessful')
    expect(actions).toContain('note:successful')
    expect(actions).toContain('note:general')
    expect(actions).toContain('status:skipped')
    expect(actions).toContain('open:https://li/job-1')
    expect(actions).toContain('flag:4445084022')
    expect(actions).toContain('rank:4445084022')

    const evalBox = el.querySelector('ai-eval-box')
    expect(evalBox).not.toBeNull()
    expect(evalBox?.getAttribute('verdict')).toBe('Strong fit')
    expect(evalBox?.getAttribute('score')).toBe('85')

    const signalRows = el.querySelectorAll('.signal-row')
    expect(signalRows.length).toBe(1)
    expect(signalRows[0].querySelector('.chip')?.textContent).toBe('skill_match')
    expect(signalRows[0].querySelector('.chip')?.classList.contains('chip-skill_match')).toBe(true)
    expect(signalRows[0].querySelector('.signal-score')?.classList.contains('pos')).toBe(true)
    expect(signalRows[0].querySelector('.signal-score')?.textContent).toBe('10')

    const flagBtn = el.querySelector<HTMLButtonElement>('[data-action="flag"]')
    expect(flagBtn?.disabled).toBe(false)
    expect(flagBtn?.textContent).toBe('Refetch Details')
  })

  it('renders a Discovered status chip for a discovered job', () => {
    const j: JobWithStatus = { ...job(), _status: 'discovered' }
    el.showJob(j, [], false)

    const chip = el.querySelector('.meta-section .chip')
    expect(chip?.textContent).toBe('Discovered')
    expect(chip?.classList.contains('chip-discovered')).toBe(true)
  })

  it('renders a Blocked status chip with chip-blocked class for a blocked job', () => {
    const j: JobWithStatus = { ...job(), _status: 'blocked', netScore: -100 }
    el.showJob(j, [], false)

    const chip = el.querySelector('.meta-section .chip')
    expect(chip?.textContent).toBe('Blocked')
    expect(chip?.classList.contains('chip-blocked')).toBe(true)
  })

  it('renders a Declined status chip with chip-declined class for a declined job', () => {
    const j: JobWithStatus = { ...job(), _status: 'declined' }
    el.showJob(j, [], false)

    const chip = el.querySelector('.meta-section .chip')
    expect(chip?.textContent).toBe('Declined')
    expect(chip?.classList.contains('chip-declined')).toBe(true)
  })

  it('renders an Unsuccessful status chip with chip-unsuccessful class', () => {
    const j: JobWithStatus = { ...job(), _status: 'unsuccessful' }
    el.showJob(j, [], false)

    const chip = el.querySelector('.meta-section .chip')
    expect(chip?.textContent).toBe('Unsuccessful')
    expect(chip?.classList.contains('chip-unsuccessful')).toBe(true)
  })

  it('renders a Successful status chip with chip-successful class', () => {
    const j: JobWithStatus = { ...job(), _status: 'successful' }
    el.showJob(j, [], false)

    const chip = el.querySelector('.meta-section .chip')
    expect(chip?.textContent).toBe('Successful')
    expect(chip?.classList.contains('chip-successful')).toBe(true)
  })

  it('renders an Interviewing status chip with chip-interviewing class', () => {
    const j: JobWithStatus = { ...job(), _status: 'interviewing' }
    el.showJob(j, [], false)

    const chip = el.querySelector('.meta-section .chip')
    expect(chip?.textContent).toBe('Interviewing')
    expect(chip?.classList.contains('chip-interviewing')).toBe(true)
  })

  it('opens the job-note-dialog when Mark applied is clicked', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], false)

    el.querySelector<HTMLButtonElement>('[data-action="note"][data-kind="applied"]')?.click()

    const dialog = el.querySelector<HTMLDialogElement>('job-note-dialog dialog')
    expect(dialog?.hasAttribute('open')).toBe(true)
    const dateField = el.querySelector<HTMLElement>('job-note-dialog [data-note-date]')
    expect(dateField?.hasAttribute('hidden')).toBe(false)
  })

  it('opens the job-note-dialog when Mark interviewing is clicked', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], false)

    el.querySelector<HTMLButtonElement>('[data-action="note"][data-kind="interviewing"]')?.click()

    const dialog = el.querySelector<HTMLDialogElement>('job-note-dialog dialog')
    expect(dialog?.hasAttribute('open')).toBe(true)
    const dateField = el.querySelector<HTMLElement>('job-note-dialog [data-note-date]')
    expect(dateField?.hasAttribute('hidden')).toBe(false)
  })

  it('opens the job-note-dialog when Mark declined is clicked', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], false)

    el.querySelector<HTMLButtonElement>('[data-action="note"][data-kind="declined"]')?.click()

    const dialog = el.querySelector<HTMLDialogElement>('job-note-dialog dialog')
    expect(dialog?.hasAttribute('open')).toBe(true)
  })

  it('opens the job-note-dialog when Mark unsuccessful is clicked', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], false)

    el.querySelector<HTMLButtonElement>('[data-action="note"][data-kind="unsuccessful"]')?.click()

    const dialog = el.querySelector<HTMLDialogElement>('job-note-dialog dialog')
    expect(dialog?.hasAttribute('open')).toBe(true)
    const dateField = el.querySelector<HTMLElement>('job-note-dialog [data-note-date]')
    expect(dateField?.hasAttribute('hidden')).toBe(false)
  })

  it('opens the job-note-dialog when Mark successful is clicked', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], false)

    el.querySelector<HTMLButtonElement>('[data-action="note"][data-kind="successful"]')?.click()

    const dialog = el.querySelector<HTMLDialogElement>('job-note-dialog dialog')
    expect(dialog?.hasAttribute('open')).toBe(true)
    const dateField = el.querySelector<HTMLElement>('job-note-dialog [data-note-date]')
    expect(dateField?.hasAttribute('hidden')).toBe(false)
  })

  it('opens the job-note-dialog with the date field hidden when Add note is clicked', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], false)

    el.querySelector<HTMLButtonElement>('[data-action="note"][data-kind="general"]')?.click()

    const dialog = el.querySelector<HTMLDialogElement>('job-note-dialog dialog')
    expect(dialog?.hasAttribute('open')).toBe(true)
    const dateField = el.querySelector<HTMLElement>('job-note-dialog [data-note-date]')
    expect(dateField?.hasAttribute('hidden')).toBe(true)
  })

  it('opens the dialog in note mode with the kind select visible when Add note is clicked', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], false)

    el.querySelector<HTMLButtonElement>('[data-action="note"][data-kind="general"]')?.click()

    const kindSelect = el.querySelector<HTMLSelectElement>('job-note-dialog #note-kind')
    expect(kindSelect?.hidden).toBe(false)
    expect(kindSelect?.value).toBe('general')
  })

  it('opens the dialog in status mode with the kind select hidden when Mark applied is clicked', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], false)

    el.querySelector<HTMLButtonElement>('[data-action="note"][data-kind="applied"]')?.click()

    const kindSelect = el.querySelector<HTMLSelectElement>('job-note-dialog #note-kind')
    expect(kindSelect?.hidden).toBe(true)
  })

  it('renders the Notes section via setNotes with a kind chip and note text', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], false)

    const notes: JobNote[] = [
      {
        id: 1,
        jobId: 1,
        kind: 'applied',
        note: 'Sent my CV on the site',
        createdAt: '2026-08-10 10:00:00',
        updatedAt: '2026-08-10 10:00:00',
      },
    ]
    el.setNotes(notes)

    const notesTab = el.querySelector<HTMLButtonElement>('[data-tab="notes"]')
    notesTab?.click()

    const metaLabel = el.querySelector('.meta-section .meta-label')
    expect(metaLabel).not.toBeNull()
    expect(el.querySelector('.meta-panel')?.textContent).toContain('Notes')
    const noteRow = el.querySelector('.note-row')
    expect(noteRow).not.toBeNull()
    expect(noteRow?.querySelector('.chip')?.textContent).toBe('Applied')
    expect(noteRow?.querySelector('.note-text')?.textContent).toBe('Sent my CV on the site')
    expect(noteRow?.querySelector('.note-date')?.textContent).toBe('2026-08-10 10:00:00')
  })

  it('renders an interviewing note kind with Interviewing chip label', () => {
    const j: JobWithStatus = { ...job(), _status: 'interviewing', netScore: 50 }
    el.showJob(j, [], false)

    const notes: JobNote[] = [
      {
        id: 1,
        jobId: 1,
        kind: 'interviewing',
        note: 'Phone screen on 5 Aug',
        createdAt: '2026-08-05 14:00:00',
        updatedAt: '2026-08-05 14:00:00',
      },
    ]
    el.setNotes(notes)

    const notesTab = el.querySelector<HTMLButtonElement>('[data-tab="notes"]')
    notesTab?.click()

    const noteRow = el.querySelector('.note-row')
    expect(noteRow?.querySelector('.chip')?.textContent).toBe('Interviewing')
    expect(noteRow?.querySelector('.note-text')?.textContent).toBe('Phone screen on 5 Aug')
  })

  it('disables the flag button when queued is true', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], true)
    const flagBtn = el.querySelector<HTMLButtonElement>('[data-action="flag"]')
    expect(flagBtn?.disabled).toBe(true)
    expect(flagBtn?.textContent).toBe('Queued')
  })

  it('shows Fetch Details when descriptionHtml is null and Refetch Details when present', () => {
    const jNoDesc: JobWithStatus = { ...job({ descriptionHtml: null }), _status: 'new', netScore: 50 }
    el.showJob(jNoDesc, [], false)
    expect(el.querySelector<HTMLButtonElement>('[data-action="flag"]')?.textContent).toBe('Fetch Details')

    const jWithDesc: JobWithStatus = { ...job({ descriptionHtml: '<p>text</p>' }), _status: 'new', netScore: 50 }
    el.showJob(jWithDesc, [], false)
    expect(el.querySelector<HTMLButtonElement>('[data-action="flag"]')?.textContent).toBe('Refetch Details')
  })

  it('dispatches job-meta:rank when the Re-rank button is clicked', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 50 }
    el.showJob(j, [], false)
    let received: { jobId: number; providerJobId: string } | undefined
    el.addEventListener('job-meta:rank', event => {
      received = (event as CustomEvent<{ jobId: number; providerJobId: string }>).detail
    })
    el.querySelector<HTMLButtonElement>('[data-action="rank"]')?.click()
    expect(received).toEqual({ jobId: 1, providerJobId: '4445084022' })
  })

  it('enables the Re-rank button even without descriptionHtml', () => {
    const j: JobWithStatus = { ...job({ descriptionHtml: null }), _status: 'new', netScore: 50 }
    el.showJob(j, [], false)
    const rankBtn = el.querySelector<HTMLButtonElement>('[data-action="rank"]')
    expect(rankBtn?.disabled).toBe(false)
  })

  it('dispatches job-meta:rank when the Re-rank button is clicked for a blocked job', () => {
    const j: JobWithStatus = { ...job({ descriptionHtml: null }), _status: 'blocked', netScore: -100 }
    el.showJob(j, [], false)
    let received: { jobId: number; providerJobId: string } | undefined
    el.addEventListener('job-meta:rank', event => {
      received = (event as CustomEvent<{ jobId: number; providerJobId: string }>).detail
    })
    el.querySelector<HTMLButtonElement>('[data-action="rank"]')?.click()
    expect(received).toEqual({ jobId: 1, providerJobId: '4445084022' })
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
    let received: { jobId: number; providerJobId: string } | undefined
    el.addEventListener('job-meta:flag', event => {
      received = (event as CustomEvent<{ jobId: number; providerJobId: string }>).detail
    })
    el.querySelector<HTMLButtonElement>('[data-action="flag"]')?.click()
    expect(received).toEqual({ jobId: 1, providerJobId: '4445084022' })
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

  it('maps netScore to the five verdict bands at every boundary', () => {
    const cases: Array<[number, string]> = [
      [75, 'Strong fit'],
      [74, 'Good fit'],
      [60, 'Good fit'],
      [59, 'Moderate fit'],
      [45, 'Moderate fit'],
      [44, 'Weak fit'],
      [30, 'Weak fit'],
      [29, 'Poor fit'],
    ]
    for (const [score, expected] of cases) {
      el.showJob({ ...job(), _status: 'new', netScore: score }, [], false)
      expect(el.querySelector('ai-eval-box')?.getAttribute('verdict')).toBe(expected)
    }
  })

  it('marks postings within 7 days as urgent with a Recent chip', () => {
    const sixDays = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)
    el.showJob({ ...job({ postedAt: sixDays }), _status: 'new', netScore: 80 }, [], false)
    expect(el.querySelector('ai-eval-box .chip-recent')?.textContent).toBe('Recent')
  })

  it('does not mark postings older than 7 days as urgent', () => {
    const eightDays = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10)
    el.showJob({ ...job({ postedAt: eightDays }), _status: 'new', netScore: 80 }, [], false)
    expect(el.querySelector('ai-eval-box .chip-recent')).toBeNull()
  })

  it('does not mark jobs without a postedAt date as urgent', () => {
    el.showJob({ ...job({ postedAt: null }), _status: 'new', netScore: 80 }, [], false)
    expect(el.querySelector('ai-eval-box .chip-recent')).toBeNull()
  })

  it('passes strengths and gaps from an eval_summary signal to the eval box', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 61 }
    const sigs = [
      signal({
        source: 'llm_deep_eval',
        signalType: 'eval_summary',
        score: 0,
        metadata: {
          strengths: ['Deep TypeScript match (fact: TypeScript)'],
          gaps: ['No Kafka experience (gap: Kafka)'],
        },
      }),
    ]
    el.showJob(j, sigs, false)

    const labels = el.querySelectorAll('ai-eval-box .eval-why-label')
    expect(labels).toHaveLength(2)
    expect(labels[0]?.textContent).toBe('Strengths')
    expect(labels[1]?.textContent).toBe('Gaps')

    const lists = el.querySelectorAll('ai-eval-box .eval-why-block ul')
    expect(lists[0]?.textContent).toContain('Deep TypeScript match (fact: TypeScript)')
    expect(lists[1]?.textContent).toContain('No Kafka experience (gap: Kafka)')
  })

  it('renders no strengths or gaps lists without an eval_summary signal', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 61 }
    el.showJob(j, [signal({ source: 'llm_deep_eval', signalType: 'skill_match', score: 50 })], false)
    expect(el.querySelector('ai-eval-box .eval-why-lists')).toBeNull()
  })

  it('does not render eval_summary in the signals list', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 61 }
    const sigs = [
      signal({
        source: 'llm_deep_eval',
        signalType: 'eval_summary',
        score: 0,
        metadata: { strengths: ['a'], gaps: ['b'] },
      }),
      signal({ source: 'llm_deep_eval', signalType: 'skill_match', score: 35, metadata: { dimension: 'technical' } }),
    ]
    el.showJob(j, sigs, false)
    const signalRows = el.querySelectorAll('.signal-row')
    expect(signalRows.length).toBe(1)
    expect(signalRows[0].querySelector('.chip')?.textContent).toBe('skill_match')
  })

  it('renders dimension label from metadata when present', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 61 }
    const sigs = [
      signal({ source: 'llm_deep_eval', signalType: 'skill_match', score: 35, metadata: { dimension: 'technical' } }),
    ]
    el.showJob(j, sigs, false)
    const dimensionEl = el.querySelector('.signal-dimension')
    expect(dimensionEl?.textContent).toBe('technical')
  })

  it('renders dealbreaker with no dimension label', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: -100 }
    const sigs = [signal({ signalType: 'dealbreaker', score: -100 })]
    el.showJob(j, sigs, false)
    const signalRow = el.querySelector('.signal-row')
    expect(signalRow?.querySelector('.chip')?.textContent).toBe('dealbreaker')
    expect(signalRow?.querySelector('.chip')?.classList.contains('chip-dealbreaker')).toBe(true)
    expect(signalRow?.querySelector('.signal-dimension')).toBeNull()
    expect(signalRow?.querySelector('.signal-score')?.textContent).toBe('-100')
  })
})
