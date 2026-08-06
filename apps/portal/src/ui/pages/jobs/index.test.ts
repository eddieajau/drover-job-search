/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { Job } from '../../../shared/types.js'
import type { JobsViewState, JobWithStatus } from '../../jobs-view.js'
import './index.js'
import type { JobsPage } from './index.js'

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
    descriptionHtml: null,
    ...overrides,
  }
}

function state(overrides: Partial<JobsViewState> = {}): JobsViewState {
  return {
    status: 'done',
    message: '',
    all: [],
    jobs: [],
    filters: { priority: '', status: '', search: '', score: '' },
    selectedId: null,
    page: 1,
    pageSize: 50,
    total: 0,
    ...overrides,
  }
}

describe('jobs-page', () => {
  let el: JobsPage

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('jobs-page')
    document.body.appendChild(el)
  })

  it('renders the toolbar, filters, list and detail panels', () => {
    expect(el.querySelector('job-stats')).not.toBeNull()
    expect(el.querySelector('filter-bar')).not.toBeNull()
    expect(el.querySelector('#btn-search')).not.toBeNull()
    expect(el.querySelector('#btn-export')).toBeNull()
    expect(el.querySelector('job-list')).not.toBeNull()
    expect(el.querySelector('job-detail')).not.toBeNull()
    expect(el.querySelector('pager-nav')).not.toBeNull()
  })

  it('forwards pagination to the pager element via attributes', () => {
    el.setState(state({ page: 2, pageSize: 10, total: 25 }))
    const pager = el.querySelector('pager-nav')
    expect(pager?.getAttribute('page')).toBe('2')
    expect(pager?.getAttribute('page-size')).toBe('10')
    expect(pager?.getAttribute('total')).toBe('25')
  })

  it('dispatches jobs-page:ready on connect', () => {
    const received = { fired: false }
    document.addEventListener('jobs-page:ready', () => {
      received.fired = true
    })
    document.body.appendChild(document.createElement('jobs-page'))
    expect(received.fired).toBe(true)
  })

  it('forwards state to the list, stats and detail', () => {
    const j: JobWithStatus = { ...job(), _status: 'new' }
    el.setState(state({ all: [j], jobs: [j], selectedId: 1 }))
    expect(el.querySelector('job-list')?.querySelector('.card-title')?.textContent).toBe('Staff Engineer')
    expect(el.querySelector('job-stats')?.textContent).toContain('1 total')
    expect(el.querySelector('job-stats')?.textContent).toContain('1 new')
    expect(el.querySelector('job-detail')?.querySelector('.company')?.textContent).toBe('Acme')
  })

  it('shows the detail empty state when nothing is selected', () => {
    const j: JobWithStatus = { ...job(), _status: 'new' }
    el.setState(state({ all: [j], jobs: [j], selectedId: null }))
    expect(el.querySelector('job-detail')?.querySelector('.detail-empty')).not.toBeNull()
  })

  it('dispatches jobs-page:search from the Search button', () => {
    const received = { fired: false }
    el.addEventListener('jobs-page:search', () => {
      received.fired = true
    })
    el.querySelector<HTMLButtonElement>('#btn-search')?.click()
    expect(received.fired).toBe(true)
  })
})
