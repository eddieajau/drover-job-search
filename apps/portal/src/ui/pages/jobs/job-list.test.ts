/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { Job } from '../../../shared/types.js'
import type { JobWithStatus } from '../../jobs-view.js'
import './job-card.js'
import './job-list.js'
import type { JobList } from './job-list.js'

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
    status: 'new',
    descriptionHtml: null,
    ...overrides,
  }
}

function withStatus(
  j: Job,
  status: JobWithStatus['_status'] = 'new',
  netScore?: number,
  gated?: boolean
): JobWithStatus {
  return { ...j, _status: status, netScore, gated }
}

describe('job-list', () => {
  let el: JobList

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('job-list')
    document.body.appendChild(el)
  })

  it('renders the idle state', () => {
    el.setState({ status: 'idle', message: '', jobs: [], selectedId: null })
    expect(el.querySelector('.loading')?.textContent).toBe('Click Search to start')
  })

  it('renders the loading state', () => {
    el.setState({ status: 'loading', message: '', jobs: [], selectedId: null })
    expect(el.querySelector('.loading')?.textContent).toBe('Loading...')
  })

  it('renders an error state', () => {
    el.setState({ status: 'error', message: 'boom', jobs: [], selectedId: null })
    expect(el.querySelector('.load-error')?.textContent).toContain('boom')
  })

  it('shows the empty state for a done list with no matches', () => {
    el.setState({ status: 'done', message: '', jobs: [], selectedId: null })
    expect(el.querySelector('.empty-state')?.textContent).toBe('No jobs match filters')
  })

  it('renders job-card elements with metadata', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job())], selectedId: null })
    expect(el.querySelector('job-card')).not.toBeNull()
    expect(el.querySelector('.job-title')?.textContent).toBe('Staff Engineer')
    expect(el.querySelector('.job-company')?.textContent).toBe('Acme')
    expect(el.querySelector('.job-card')?.classList.contains('unseen')).toBe(true)
  })

  it('marks non-new jobs as seen', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job(), 'applied')], selectedId: null })
    expect(el.querySelector('.job-card')?.classList.contains('unseen')).toBe(false)
  })

  it('dispatches job-list:select on card click via re-dispatch', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job())], selectedId: null })
    const received = { jobId: 0, providerJobId: '' }
    el.addEventListener('job-list:select', event => {
      const detail = (event as CustomEvent<{ jobId: number; providerJobId: string }>).detail
      received.jobId = detail.jobId
      received.providerJobId = detail.providerJobId
    })
    el.querySelector<HTMLElement>('job-card')?.click()
    expect(received.jobId).toBe(1)
    expect(received.providerJobId).toBe('4445084022')
  })

  it('renders a score chip for jobs with netScore', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job(), 'new', 85)], selectedId: null })
    const score = el.querySelector('.score')
    expect(score).not.toBeNull()
    expect(score?.textContent).toBe('85')
    expect(score?.classList.contains('score-high')).toBe(true)
  })

  it('renders mid class for scores below threshold', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job(), 'new', 20)], selectedId: null })
    const score = el.querySelector('.score')
    expect(score?.classList.contains('score-mid')).toBe(true)
  })

  it('renders negative scores with minus sign', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job(), 'new', -15)], selectedId: null })
    const score = el.querySelector('.score')
    expect(score?.textContent).toBe('-15')
  })

  it('renders a Blocked chip for gated jobs', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job(), 'new', 50, true)], selectedId: null })
    const chip = el.querySelector('.card-chip-blocked')
    expect(chip?.textContent).toBe('Blocked')
    expect(el.querySelector('.job-card')?.classList.contains('gated')).toBe(true)
  })

  it('sets the queued attribute on cards for queued jobs', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job({ queued: true }))], selectedId: null })
    expect(el.querySelector('job-card')?.hasAttribute('queued')).toBe(true)
  })

  it('sets the skipped attribute on cards for skipped jobs', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job(), 'skipped')], selectedId: null })
    expect(el.querySelector('job-card')?.hasAttribute('skipped')).toBe(true)
  })

  it('lets job-card:flag bubble through the list without re-dispatching', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job())], selectedId: null })
    const received: Array<{ jobId: number; providerJobId: string }> = []
    let listFlagFired = false
    el.addEventListener('job-card:flag', event => {
      received.push((event as CustomEvent<{ jobId: number; providerJobId: string }>).detail)
    })
    el.addEventListener('job-list:flag', () => {
      listFlagFired = true
    })

    el.querySelector<HTMLButtonElement>('job-card .tri-yes')?.click()
    expect(received).toEqual([{ jobId: 1, providerJobId: '4445084022' }])
    expect(listFlagFired).toBe(false)
  })

  it('forwards job-card:status as job-list:status on skip', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job())], selectedId: null })
    const received: Array<{ jobId: number; status: string }> = []
    el.addEventListener('job-list:status', event => {
      received.push((event as CustomEvent<{ jobId: number; status: string }>).detail)
    })

    el.querySelector<HTMLButtonElement>('job-card .tri-no')?.click()
    expect(received).toEqual([{ jobId: 1, status: 'skipped' }])
  })

  it('sets has-description on the card when job has descriptionHtml', () => {
    el.setState({
      status: 'done',
      message: '',
      jobs: [withStatus(job({ descriptionHtml: '<p>desc</p>' }))],
      selectedId: null,
    })
    expect(el.querySelector('job-card')?.hasAttribute('has-description')).toBe(true)
  })

  it('does not set has-description on the card when job has no descriptionHtml', () => {
    el.setState({
      status: 'done',
      message: '',
      jobs: [withStatus(job({ descriptionHtml: null }))],
      selectedId: null,
    })
    expect(el.querySelector('job-card')?.hasAttribute('has-description')).toBe(false)
  })
})
