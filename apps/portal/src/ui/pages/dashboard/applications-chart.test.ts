/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ApplicationsChart as ApplicationsChartData } from '../../../shared/types.js'
import './applications-chart.js'
import type { ApplicationsChart } from './applications-chart.js'

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

describe('applications-chart', () => {
  let el: ApplicationsChart

  beforeEach(() => {
    document.body.innerHTML = ''
    el = document.createElement('applications-chart')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the chart container with svg', () => {
    expect(el.querySelector('.chart svg')).not.toBeNull()
  })

  it('renders 14 rect bars when data is set', () => {
    el.setData(sample())
    expect(el.querySelectorAll('.chart svg rect').length).toBe(14)
  })

  it('renders 14 baseline bars with data-empty when all counts are zero', () => {
    const zeros: ApplicationsChartData = {
      days: Array.from({ length: 14 }, (_, i) => ({
        day: `2026-08-${String(i + 6).padStart(2, '0')}`,
        count: 0,
      })),
    }
    el.setData(zeros)
    expect(el.querySelectorAll('.chart svg rect').length).toBe(14)
    expect(el.hasAttribute('data-empty')).toBe(true)
  })

  it('sets data-empty on null input', () => {
    el.setData(null)
    expect(el.hasAttribute('data-empty')).toBe(true)
  })

  it('removes data-empty when there are non-zero counts', () => {
    el.setData(sample())
    expect(el.hasAttribute('data-empty')).toBe(false)
  })

  it('makes the tallest bar the highest rect', () => {
    el.setData(sample())
    const rects = Array.from(el.querySelectorAll<SVGRectElement>('.chart svg rect'))
    const heights = rects.map(r => parseFloat(r.getAttribute('height') ?? '0'))
    const maxIdx = heights.indexOf(Math.max(...heights))
    expect(heights[maxIdx]).toBe(140)
    expect(rects[maxIdx].querySelector('title')?.textContent).toBe('2026-08-15: 3 applications')
  })

  it('each bar has a title with day and count', () => {
    el.setData(sample())
    const rects = Array.from(el.querySelectorAll<SVGRectElement>('.chart svg rect'))
    const titles = rects.map(r => r.querySelector('title')?.textContent ?? '')
    expect(titles[2]).toBe('2026-08-08: 2 applications')
    expect(titles[4]).toBe('2026-08-10: 1 applications')
    expect(titles[9]).toBe('2026-08-15: 3 applications')
  })

  it('the SVG has role="img" and an aria-label', () => {
    const svg = el.querySelector<SVGSVGElement>('.chart svg')
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toBe('Applications per day, last 14 days')
  })
})
