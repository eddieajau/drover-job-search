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
    filters: { status: 'new', search: '', sort: 'score' },
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

  it('renders the three-pane workspace with toolbar, list, footer, detail and meta', () => {
    expect(el.querySelector('.pane-list job-list')).not.toBeNull()
    expect(el.querySelector('.list-toolbar filter-bar')).not.toBeNull()
    expect(el.querySelector('.pane-foot pager-nav')).not.toBeNull()
    expect(el.querySelector('.pane-foot job-stats')).not.toBeNull()
    expect(el.querySelector('.pane-content job-detail')).not.toBeNull()
    expect(el.querySelector('.pane-meta job-meta-panel')).not.toBeNull()
    expect(el.querySelector('#btn-search')).toBeNull()
  })

  it('keeps job-list as the scroll region between the toolbar and the pager foot', () => {
    const paneChildren = [...el.querySelector('.pane-list')!.children].map(child => child.tagName.toLowerCase())
    expect(paneChildren).toEqual(['div', 'job-list', 'div'])
    expect(el.querySelector('.list-toolbar')!.nextElementSibling!.tagName.toLowerCase()).toBe('job-list')
    expect(el.querySelector('job-list')!.nextElementSibling!.classList.contains('pane-foot')).toBe(true)
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
    expect(el.querySelector('job-list')?.querySelector('.job-title')?.textContent).toBe('Staff Engineer')
    expect(el.querySelector('job-stats')?.textContent).toContain('1 total')
    expect(el.querySelector('job-stats')?.textContent).toContain('1 new')
    expect(el.querySelector('job-detail')?.querySelector('.detail-company')?.textContent).toBe('Acme')
  })

  it('shows the detail empty state when nothing is selected', () => {
    const j: JobWithStatus = { ...job(), _status: 'new' }
    el.setState(state({ all: [j], jobs: [j], selectedId: null }))
    expect(el.querySelector('job-detail')?.querySelector('.detail-empty')).not.toBeNull()
  })

  it('forwards selected job and signals to the meta panel via setJobMeta', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', netScore: 85 }
    el.setState(state({ all: [j], jobs: [j], selectedId: 1 }))
    el.setJobMeta(1, [], false)
    const metaPanel = el.querySelector('job-meta-panel')
    expect(metaPanel?.querySelector('.meta-panel')).not.toBeNull()
    expect(metaPanel?.querySelector('.meta-empty')).toBeNull()
  })

  it('shows the meta panel placeholder with the selected job on setState with selectedId', () => {
    const j: JobWithStatus = { ...job(), _status: 'new', queued: true }
    el.setState(state({ all: [j], jobs: [j], selectedId: 1 }))
    const metaPanel = el.querySelector('job-meta-panel')
    expect(metaPanel?.querySelector('.meta-panel')).not.toBeNull()
    expect(metaPanel?.querySelector('.meta-empty')).toBeNull()
    expect(metaPanel?.querySelector('button[data-action="flag"]')?.textContent).toContain('Queued')
  })

  it('shows the empty meta panel when selectedId is null', () => {
    const j: JobWithStatus = { ...job(), _status: 'new' }
    el.setState(state({ all: [j], jobs: [j], selectedId: null }))
    const metaPanel = el.querySelector('job-meta-panel')
    expect(metaPanel?.querySelector('.meta-empty')).not.toBeNull()
  })

  it('dispatches jobs-page:selected with jobId on first setState with selectedId', () => {
    const received: number[] = []
    document.addEventListener('jobs-page:selected', ((e: CustomEvent) => {
      received.push(e.detail.jobId)
    }) as EventListener)
    const j: JobWithStatus = { ...job(), _status: 'new' }
    el.setState(state({ all: [j], jobs: [j], selectedId: 1 }))
    expect(received).toEqual([1])
  })

  it('does not re-dispatch jobs-page:selected on subsequent setState with the same selectedId', () => {
    const received: number[] = []
    document.addEventListener('jobs-page:selected', ((e: CustomEvent) => {
      received.push(e.detail.jobId)
    }) as EventListener)
    const j: JobWithStatus = { ...job(), _status: 'new' }
    el.setState(state({ all: [j], jobs: [j], selectedId: 1 }))
    el.setState(state({ all: [j], jobs: [j], selectedId: 1 }))
    expect(received).toEqual([1])
  })
})
