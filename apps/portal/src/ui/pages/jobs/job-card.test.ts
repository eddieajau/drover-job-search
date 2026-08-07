/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import './job-card.js'
import type { JobCard } from './job-card.js'

function createCard(attrs: Record<string, string> = {}): JobCard {
  const card = document.createElement('job-card') as JobCard
  for (const [key, value] of Object.entries(attrs)) {
    card.setAttribute(key, value)
  }
  document.body.appendChild(card)
  return card
}

describe('job-card', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a high-score active unseen card', () => {
    const card = createCard({
      'job-id': '1',
      'provider-job-id': 'job-1',
      title: 'Staff Engineer',
      company: 'Acme',
      location: 'Brisbane',
      posted: '2d',
      score: '85',
      active: '',
    })

    const inner = card.querySelector('.job-card')
    expect(inner?.classList.contains('active')).toBe(true)
    expect(inner?.classList.contains('unseen')).toBe(true)

    const score = card.querySelector('.score')
    expect(score?.classList.contains('score-high')).toBe(true)
    expect(score?.textContent).toBe('+85')
  })

  it('renders auto-skip for gated jobs', () => {
    const card = createCard({
      'job-id': '2',
      'provider-job-id': 'job-2',
      title: 'Developer',
      company: 'Beta',
      location: 'Sydney',
      posted: '1d',
      gated: '',
    })

    const score = card.querySelector('.score')
    expect(score?.classList.contains('score-low')).toBe(true)
    expect(score?.textContent).toBe('auto-skip')
  })

  it('dispatches job-card:select on card body click', () => {
    const card = createCard({
      'job-id': '3',
      'provider-job-id': 'job-3',
      title: 'Engineer',
      company: 'Gamma',
      location: 'Melbourne',
      posted: '3d',
    })

    const received = { jobId: 0, providerJobId: '' }
    card.addEventListener('job-card:select', event => {
      const detail = (event as CustomEvent<{ jobId: number; providerJobId: string }>).detail
      received.jobId = detail.jobId
      received.providerJobId = detail.providerJobId
    })

    card.querySelector<HTMLElement>('.job-title')?.click()
    expect(received.jobId).toBe(3)
    expect(received.providerJobId).toBe('job-3')
  })

  it('does not render action buttons', () => {
    const card = createCard({
      'job-id': '4',
      'provider-job-id': 'job-4',
      title: 'Engineer',
      company: 'Delta',
      location: 'Perth',
      posted: '4d',
    })

    expect(card.querySelector('.card-actions')).toBeNull()
    expect(card.querySelector('button[data-action="status"]')).toBeNull()
  })

  it('re-renders when score attribute changes', () => {
    const card = createCard({
      'job-id': '5',
      'provider-job-id': 'job-5',
      title: 'Engineer',
      company: 'Epsilon',
      location: 'Adelaide',
      posted: '5d',
      score: '20',
    })

    let score = card.querySelector('.score')
    expect(score?.classList.contains('score-mid')).toBe(true)
    expect(score?.textContent).toBe('+20')

    card.setAttribute('score', '85')
    score = card.querySelector('.score')
    expect(score?.classList.contains('score-high')).toBe(true)
    expect(score?.textContent).toBe('+85')
  })

  it('renders mid-score for scores below threshold', () => {
    const card = createCard({
      'job-id': '6',
      'provider-job-id': 'job-6',
      title: 'Engineer',
      company: 'Zeta',
      location: 'Hobart',
      posted: '6d',
      score: '30',
    })

    const score = card.querySelector('.score')
    expect(score?.classList.contains('score-mid')).toBe(true)
    expect(score?.textContent).toBe('+30')
  })

  it('renders negative scores with minus sign', () => {
    const card = createCard({
      'job-id': '7',
      'provider-job-id': 'job-7',
      title: 'Engineer',
      company: 'Eta',
      location: 'Darwin',
      posted: '7d',
      score: '-15',
    })

    const score = card.querySelector('.score')
    expect(score?.textContent).toBe('-15')
  })

  it('does not render a score span when no score is set', () => {
    const card = createCard({
      'job-id': '8',
      'provider-job-id': 'job-8',
      title: 'Engineer',
      company: 'Theta',
      location: 'Canberra',
      posted: '8d',
    })

    expect(card.querySelector('.score')).toBeNull()
  })

  it('sets tabindex and role for keyboard accessibility', () => {
    const card = createCard({
      'job-id': '9',
      'provider-job-id': 'job-9',
      title: 'Engineer',
      company: 'Iota',
      location: 'Brisbane',
      posted: '1d',
    })

    expect(card.getAttribute('tabindex')).toBe('0')
    expect(card.getAttribute('role')).toBe('row')
  })

  it('renders a relative posted-age label in .posted', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-07T12:00:00Z'))

    const card = createCard({
      'job-id': '10',
      'provider-job-id': 'job-10',
      title: 'Engineer',
      company: 'Kappa',
      location: 'Brisbane',
      posted: '2026-08-05',
    })

    expect(card.querySelector('.posted')?.textContent).toBe('2d')
  })

  it('dispatches job-card:flag on flag click and not job-card:select', () => {
    const card = createCard({
      'job-id': '11',
      'provider-job-id': 'job-11',
      title: 'Engineer',
      company: 'Lambda',
      location: 'Sydney',
      posted: '2d',
    })

    const flagEvents: Array<{ jobId: number; providerJobId: string }> = []
    let selectFired = false
    card.addEventListener('job-card:flag', event => {
      flagEvents.push((event as CustomEvent<{ jobId: number; providerJobId: string }>).detail)
    })
    card.addEventListener('job-card:select', () => {
      selectFired = true
    })

    card.querySelector<HTMLButtonElement>('.card-flag')?.click()
    expect(flagEvents).toEqual([{ jobId: 11, providerJobId: 'job-11' }])
    expect(selectFired).toBe(false)
  })

  it('dispatches job-card:status with skipped on skip click and not job-card:select', () => {
    const card = createCard({
      'job-id': '11',
      'provider-job-id': 'job-11',
      title: 'Engineer',
      company: 'Lambda',
      location: 'Sydney',
      posted: '2d',
    })

    const statusEvents: Array<{ jobId: number; providerJobId: string; status: string }> = []
    let selectFired = false
    card.addEventListener('job-card:status', event => {
      statusEvents.push((event as CustomEvent<{ jobId: number; providerJobId: string; status: string }>).detail)
    })
    card.addEventListener('job-card:select', () => {
      selectFired = true
    })

    const skip = card.querySelector<HTMLButtonElement>('.card-skip')
    expect(skip?.getAttribute('aria-label')).toBe('Skip job')
    skip?.click()
    expect(statusEvents).toEqual([{ jobId: 11, providerJobId: 'job-11', status: 'skipped' }])
    expect(selectFired).toBe(false)
  })

  it('renders a filled flag with aria-pressed=true when queued', () => {
    const card = createCard({
      'job-id': '12',
      'provider-job-id': 'job-12',
      title: 'Engineer',
      company: 'Mu',
      location: 'Perth',
      posted: '3d',
      queued: '',
    })

    const flag = card.querySelector<HTMLButtonElement>('.card-flag')
    expect(flag?.getAttribute('aria-pressed')).toBe('true')
    expect(flag?.querySelector('svg')?.getAttribute('fill')).toBe('currentColor')
  })

  it('renders a hollow flag with aria-pressed=false when not queued', () => {
    const card = createCard({
      'job-id': '13',
      'provider-job-id': 'job-13',
      title: 'Engineer',
      company: 'Nu',
      location: 'Hobart',
      posted: '4d',
    })

    const flag = card.querySelector<HTMLButtonElement>('.card-flag')
    expect(flag?.getAttribute('aria-pressed')).toBe('false')
    expect(flag?.querySelector('svg')?.getAttribute('fill')).toBe('none')
  })

  it('does not dispatch job-card:select when Enter is pressed on the flag button', () => {
    const card = createCard({
      'job-id': '14',
      'provider-job-id': 'job-14',
      title: 'Engineer',
      company: 'Xi',
      location: 'Darwin',
      posted: '5d',
    })

    let selectFired = false
    card.addEventListener('job-card:select', () => {
      selectFired = true
    })

    const flag = card.querySelector<HTMLButtonElement>('.card-flag')
    flag?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(selectFired).toBe(false)
  })

  it('reflects has-description on the inner .job-card div when set', () => {
    const card = createCard({
      'job-id': '15',
      'provider-job-id': 'job-15',
      title: 'Engineer',
      company: 'Omicron',
      location: 'Brisbane',
      posted: '1d',
      'has-description': '',
    })

    expect(card.querySelector('.job-card')?.hasAttribute('has-description')).toBe(true)
  })

  it('does not reflect has-description on the inner .job-card div when absent', () => {
    const card = createCard({
      'job-id': '16',
      'provider-job-id': 'job-16',
      title: 'Engineer',
      company: 'Pi',
      location: 'Sydney',
      posted: '2d',
    })

    expect(card.querySelector('.job-card')?.hasAttribute('has-description')).toBe(false)
  })
})
