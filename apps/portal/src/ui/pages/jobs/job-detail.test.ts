/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { Job } from '../../../shared/types.js'
import './job-detail.js'
import type { JobDetail } from './job-detail.js'

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
    description: 'Design and build.',
    ...overrides,
  }
}

describe('job-detail', () => {
  let el: JobDetail

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('job-detail')
    document.body.appendChild(el)
  })

  it('renders an empty prompt when no job is selected', () => {
    el.showJob(null)
    expect(el.querySelector('.detail-empty')?.textContent).toBe('Select a job to view details')
  })

  it('renders job details', () => {
    el.showJob({ ...job(), _status: 'new' })
    expect(el.querySelector('h2')?.textContent).toBe('Staff Engineer')
    expect(el.querySelector('.company')?.textContent).toBe('Acme')
    expect(el.querySelector('.detail-description')?.textContent).toContain('Design and build.')
  })

  it('shows the Mark New button for non-new jobs', () => {
    el.showJob({ ...job(), _status: 'applied' })
    expect(el.querySelector('button[data-status="new"]')).not.toBeNull()
  })

  it('hides the Mark New button for new jobs', () => {
    el.showJob({ ...job(), _status: 'new' })
    expect(el.querySelector('button[data-status="new"]')).toBeNull()
  })

  it('dispatches job-detail:status from action buttons', () => {
    el.showJob({ ...job(), _status: 'new' })
    const received = { jobId: 0, status: '' }
    el.addEventListener('job-detail:status', event => {
      const detail = (event as CustomEvent<{ jobId: number; status: string }>).detail
      received.jobId = detail.jobId
      received.status = detail.status
    })
    el.querySelector<HTMLButtonElement>('button[data-status="applied"]')?.click()
    expect(received).toEqual({ jobId: 1, status: 'applied' })
  })
})
