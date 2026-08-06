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
  })

  it('renders an empty prompt when no job is selected', () => {
    el.showJob(null)
    expect(el.querySelector('.detail-empty')?.textContent).toBe('Select a job to view details')
  })

  it('renders job header and description', () => {
    el.showJob({ ...job(), _status: 'new' })
    expect(el.querySelector('h2')?.textContent).toBe('Staff Engineer')
    expect(el.querySelector('.company')?.textContent).toBe('Acme')
    expect(el.querySelector('.detail-description')?.textContent).toContain('Design and build.')
  })

  it('renders descriptionHtml as formatted HTML (not escaped)', () => {
    el.showJob({ ...job({ descriptionHtml: '<h2>Heading</h2><ul><li>item</li></ul>' }), _status: 'new' })
    const description = el.querySelector('.detail-description')
    expect(description?.querySelector('h2')?.textContent).toBe('Heading')
    expect(description?.querySelector('li')?.textContent).toBe('item')
  })

  it('renders the fallback when descriptionHtml is null', () => {
    el.showJob({ ...job({ descriptionHtml: null }), _status: 'new' })
    expect(el.querySelector('.detail-description')?.querySelector('em')?.textContent).toBe(
      'No description in search results.'
    )
  })

  it('does not render action buttons', () => {
    el.showJob({ ...job(), _status: 'new' })
    expect(el.querySelector('.detail-actions')).toBeNull()
    expect(el.querySelector('button[data-action="status"]')).toBeNull()
  })
})
