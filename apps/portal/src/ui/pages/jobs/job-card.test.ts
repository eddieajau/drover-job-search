/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

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

  it('dispatches job-card:status from action buttons without selecting', () => {
    const card = createCard({
      'job-id': '4',
      'provider-job-id': 'job-4',
      title: 'Engineer',
      company: 'Delta',
      location: 'Perth',
      posted: '4d',
    })

    const received = { selectFired: false, jobId: 0, status: '' }
    card.addEventListener('job-card:select', () => {
      received.selectFired = true
    })
    card.addEventListener('job-card:status', event => {
      const detail = (event as CustomEvent<{ jobId: number; status: string }>).detail
      received.jobId = detail.jobId
      received.status = detail.status
    })

    card.querySelector<HTMLButtonElement>('button[data-action="status"][data-status="skipped"]')?.click()
    expect(received.status).toBe('skipped')
    expect(received.jobId).toBe(4)
    expect(received.selectFired).toBe(false)
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
})
