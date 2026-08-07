/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    descriptionHtml: '<p>Design and build.</p>',
    ...overrides,
  }
}

describe('job-detail', () => {
  let el: JobDetail

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('job-detail')
    document.body.appendChild(el)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-07T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders an empty prompt when no job is selected', () => {
    el.showJob(null)
    expect(el.querySelector('.detail-empty')).not.toBeNull()
    expect(el.querySelector('.detail-empty p')?.textContent).toBe('Select a job to view details')
  })

  it('renders title in .detail-head h2', () => {
    el.showJob({ ...job(), _status: 'new' })
    expect(el.querySelector('.detail-head h2')?.textContent).toBe('Staff Engineer')
  })

  it('renders company in .detail-company', () => {
    el.showJob({ ...job(), _status: 'new' })
    expect(el.querySelector('.detail-company')?.textContent).toBe('Acme')
  })

  it('renders four chips in .detail-meta (P1, category, location, posted)', () => {
    el.showJob({ ...job(), _status: 'new' })
    const chips = el.querySelectorAll('.detail-meta .chip')
    expect(chips.length).toBe(4)
    expect(chips[0].textContent).toBe('P1')
    expect(chips[0].classList.contains('chip-p1')).toBe(true)
    expect(chips[1].textContent).toBe('P1')
    expect(chips[2].textContent).toBe('Brisbane')
    expect(chips[3].textContent).toBe('Posted 2d')
  })

  it('renders "Posted unknown" when postedAt is null', () => {
    el.showJob({ ...job({ postedAt: null }), _status: 'new' })
    const chips = el.querySelectorAll('.detail-meta .chip')
    expect(chips[3].textContent).toBe('Posted unknown')
  })

  it('renders a status chip when status is not new', () => {
    el.showJob({ ...job(), _status: 'applied' })
    const chips = el.querySelectorAll('.detail-meta .chip')
    expect(chips.length).toBe(5)
    expect(chips[4].textContent).toBe('applied')
    expect(chips[4].classList.contains('chip-applied')).toBe(true)
  })

  it('renders descriptionHtml inside .job-desc', () => {
    el.showJob({ ...job({ descriptionHtml: '<h3>Heading</h3><ul><li>item</li></ul>' }), _status: 'new' })
    const desc = el.querySelector('.job-desc')
    expect(desc?.querySelector('h3')?.textContent).toBe('Heading')
    expect(desc?.querySelector('li')?.textContent).toBe('item')
  })

  it('renders the fallback when descriptionHtml is null', () => {
    el.showJob({ ...job({ descriptionHtml: null }), _status: 'new' })
    expect(el.querySelector('.job-desc em')?.textContent).toBe('No description in search results.')
  })

  it('has no data-action buttons', () => {
    el.showJob({ ...job(), _status: 'new' })
    expect(el.querySelectorAll('[data-action]').length).toBe(0)
  })
})
