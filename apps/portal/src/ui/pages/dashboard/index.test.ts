/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ApplicationsChart as ApplicationsChartData, DashboardSummary } from '../../../shared/types.js'
import './index.js'
import type { DashboardPage } from './index.js'

function sample(): ApplicationsChartData {
  return {
    days: [
      { day: '2026-08-06', count: 0 },
      { day: '2026-08-07', count: 0 },
      { day: '2026-08-08', count: 2 },
      { day: '2026-08-09', count: 0 },
      { day: '2026-08-10', count: 1 },
      { day: '2026-08-11', count: 0 },
      { day: '2026-08-12', count: 0 },
      { day: '2026-08-13', count: 0 },
      { day: '2026-08-14', count: 0 },
      { day: '2026-08-15', count: 3 },
      { day: '2026-08-16', count: 0 },
      { day: '2026-08-17', count: 0 },
      { day: '2026-08-18', count: 0 },
      { day: '2026-08-19', count: 0 },
    ],
  }
}

function sampleSummary(): DashboardSummary {
  return {
    applied: { count: 14, delta: 2 },
    inFlight: { applied: 12, interviewing: 4 },
    interviewRate: 15,
    pipeline: { applied: 12, interviewing: 4, successful: 1, unsuccessful: 3, declined: 2 },
    attention: [],
  }
}

describe('dashboard-page', () => {
  let el: DashboardPage

  beforeEach(() => {
    document.body.innerHTML = ''
    sessionStorage.clear()
    el = document.createElement('dashboard-page')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    sessionStorage.clear()
  })

  it('renders the page shell with head and dash-grid', () => {
    expect(el.querySelector('.page > .page-head h1')?.textContent).toBe('Dashboard')
    expect(el.querySelector('.page > .dash-grid')).not.toBeNull()
  })

  it('renders the current date in .page-sub', () => {
    const sub = el.querySelector('.page-head .page-sub')
    expect(sub?.textContent).toBeTruthy()
    expect(sub?.textContent).toContain(new Date().getFullYear().toString())
  })

  it('renders a date range select with 7/14/30 day options', () => {
    const sel = el.querySelector<HTMLSelectElement>('.page-head select[aria-label="Date range"]')
    expect(sel).not.toBeNull()
    const options = Array.from(sel!.options)
    expect(options).toHaveLength(3)
    expect(options.map(o => o.value)).toEqual(['7', '14', '30'])
  })

  it('defaults to 14 days', () => {
    const sel = el.querySelector<HTMLSelectElement>('.page-range')
    expect(sel?.value).toBe('14')
  })

  it('reads default from sessionStorage', () => {
    document.body.innerHTML = ''
    sessionStorage.setItem('dashboard-days', '30')
    const e = document.createElement('dashboard-page')
    document.body.appendChild(e)
    const sel = e.querySelector<HTMLSelectElement>('.page-range')
    expect(sel?.value).toBe('30')
  })

  it('rangeDays returns current selection', () => {
    expect(el.rangeDays).toBe(14)
    const sel = el.querySelector<HTMLSelectElement>('.page-range')!
    sel.value = '7'
    sel.dispatchEvent(new Event('change'))
    expect(el.rangeDays).toBe(7)
  })

  it('dispatches dashboard-range:change on select change', () => {
    const received: number[] = []
    el.addEventListener('dashboard-range:change', ((e: CustomEvent) => {
      received.push(e.detail.days)
    }) as EventListener)

    const sel = el.querySelector<HTMLSelectElement>('.page-range')!
    sel.value = '30'
    sel.dispatchEvent(new Event('change'))

    expect(received).toEqual([30])
  })

  it('the change event bubbles and is composed', () => {
    const received = { bubbled: false, composed: false }
    document.addEventListener('dashboard-range:change', ((e: CustomEvent) => {
      received.bubbled = e.bubbles
      received.composed = e.composed
    }) as EventListener)

    const sel = el.querySelector<HTMLSelectElement>('.page-range')!
    sel.value = '7'
    sel.dispatchEvent(new Event('change'))

    expect(received.bubbled).toBe(true)
    expect(received.composed).toBe(true)
  })

  it('persists selection to sessionStorage', () => {
    const sel = el.querySelector<HTMLSelectElement>('.page-range')!
    sel.value = '30'
    sel.dispatchEvent(new Event('change'))
    expect(sessionStorage.getItem('dashboard-days')).toBe('30')
  })

  it('forwards setData to the child applications-chart', () => {
    el.setData(sample())
    const chart = el.querySelector<HTMLElementTagNameMap['applications-chart']>('applications-chart')
    expect(chart?.querySelectorAll('.chart svg rect.bar').length).toBe(14)
  })

  it('forwards null setData to the child applications-chart', () => {
    el.setData(null)
    const chart = el.querySelector<HTMLElementTagNameMap['applications-chart']>('applications-chart')
    expect(chart?.hasAttribute('data-empty')).toBe(true)
  })

  it('renders three stat-card widgets', () => {
    expect(el.querySelectorAll('stat-card').length).toBe(3)
    expect(el.querySelector('#stat-applied stat-card')).not.toBeNull()
    expect(el.querySelector('#stat-inflight stat-card')).not.toBeNull()
    expect(el.querySelector('#stat-rate stat-card')).not.toBeNull()
  })

  it('setStats populates the applied card with count and delta', () => {
    el.setStats(sampleSummary())
    const card = el.querySelector<HTMLElementTagNameMap['stat-card']>('#stat-applied stat-card')!
    expect(card.querySelector('.stat-label')?.textContent).toBe('Applied · 14d')
    expect(card.querySelector('.stat-value')?.textContent).toBe('14')
    expect(card.querySelector('.stat-delta.up')?.textContent).toBe('+2')
  })

  it('setStats populates the in-flight card with combined count', () => {
    el.setStats(sampleSummary())
    const card = el.querySelector<HTMLElementTagNameMap['stat-card']>('#stat-inflight stat-card')!
    expect(card.querySelector('.stat-label')?.textContent).toBe('In flight')
    expect(card.querySelector('.stat-value')?.textContent).toBe('16')
    expect(card.querySelector('.stat-note')?.textContent).toBe('12 applied · 4 interviewing')
  })

  it('setStats populates the interview-rate card', () => {
    el.setStats(sampleSummary())
    const card = el.querySelector<HTMLElementTagNameMap['stat-card']>('#stat-rate stat-card')!
    expect(card.querySelector('.stat-value')?.textContent).toBe('15%')
    expect(card.querySelector('.stat-note')?.textContent).toBe('applied → interviewing, 14d')
  })

  it('setStats labels follow the selected range', () => {
    const sel = el.querySelector<HTMLSelectElement>('.page-range')!
    sel.value = '7'
    el.setStats(sampleSummary())
    const applied = el.querySelector<HTMLElementTagNameMap['stat-card']>('#stat-applied stat-card')!
    expect(applied.querySelector('.stat-label')?.textContent).toBe('Applied · 7d')
    const rate = el.querySelector<HTMLElementTagNameMap['stat-card']>('#stat-rate stat-card')!
    expect(rate.querySelector('.stat-note')?.textContent).toBe('applied → interviewing, 7d')
  })

  it('setStats omits the delta chip when delta is zero', () => {
    const summary = sampleSummary()
    summary.applied.delta = 0
    el.setStats(summary)
    const card = el.querySelector<HTMLElementTagNameMap['stat-card']>('#stat-applied stat-card')!
    expect(card.querySelector('.stat-delta')).toBeNull()
  })

  it('dispatches dashboard-page:ready on connect', () => {
    const received = { fired: false }
    document.addEventListener('dashboard-page:ready', () => {
      received.fired = true
    })
    document.body.appendChild(document.createElement('dashboard-page'))
    expect(received.fired).toBe(true)
  })
})
