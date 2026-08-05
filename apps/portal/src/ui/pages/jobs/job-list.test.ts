/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'
import type { Job } from '../../../shared/types.js'
import type { JobWithStatus } from '../../jobs-view.js'
import './job-list.js'
import type { JobList } from './job-list.js'

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    title: 'Staff Engineer',
    company: 'Acme',
    url: 'https://li/job-1',
    location: 'Brisbane',
    date: '2026-08-05',
    priority: 1,
    category: 'P1',
    ...overrides,
  }
}

function withStatus(j: Job, status: JobWithStatus['_status'] = 'new'): JobWithStatus {
  return { ...j, _status: status }
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

  it('renders job cards with metadata', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job())], selectedId: null })
    expect(el.querySelector('.card-title')?.textContent).toBe('Staff Engineer')
    expect(el.querySelector('.card-company')?.textContent).toBe('Acme')
    expect(el.querySelector('.card')?.classList.contains('seen')).toBe(false)
  })

  it('marks non-new jobs as seen', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job(), 'applied')], selectedId: null })
    expect(el.querySelector('.card')?.classList.contains('seen')).toBe(true)
  })

  it('dispatches job-list:select on card click', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job())], selectedId: null })
    const received = { jobId: '' }
    el.addEventListener('job-list:select', event => {
      received.jobId = (event as CustomEvent<{ jobId: string }>).detail.jobId
    })
    el.querySelector<HTMLElement>('.card')?.click()
    expect(received.jobId).toBe('job-1')
  })

  it('dispatches job-list:status from action buttons without selecting', () => {
    el.setState({ status: 'done', message: '', jobs: [withStatus(job())], selectedId: null })
    const received = { selectFired: false, status: '' }
    el.addEventListener('job-list:select', () => {
      received.selectFired = true
    })
    el.addEventListener('job-list:status', event => {
      received.status = (event as CustomEvent<{ status: string }>).detail.status
    })
    el.querySelector<HTMLButtonElement>('button[data-status="applied"]')?.click()
    expect(received.status).toBe('applied')
    expect(received.selectFired).toBe(false)
  })
})
