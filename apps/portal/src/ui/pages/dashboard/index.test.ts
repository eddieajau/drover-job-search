/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ApplicationsChart as ApplicationsChartData } from '../../../shared/types.js'
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

describe('dashboard-page', () => {
  let el: DashboardPage

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('dashboard-page')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the page shell with head and panel', () => {
    expect(el.querySelector('.page > .page-head h1')?.textContent).toBe('Dashboard')
    expect(el.querySelector('.panel > applications-chart')).not.toBeNull()
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

  it('dispatches dashboard-page:ready on connect', () => {
    const received = { fired: false }
    document.addEventListener('dashboard-page:ready', () => {
      received.fired = true
    })
    document.body.appendChild(document.createElement('dashboard-page'))
    expect(received.fired).toBe(true)
  })
})
