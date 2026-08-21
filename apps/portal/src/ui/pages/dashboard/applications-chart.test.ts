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

  it('has the correct viewBox', () => {
    const svg = el.querySelector<SVGSVGElement>('.chart svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 640 220')
  })

  it('does not have preserveAspectRatio="none"', () => {
    const svg = el.querySelector<SVGSVGElement>('.chart svg')
    expect(svg?.getAttribute('preserveAspectRatio')).not.toBe('none')
  })

  it('has role="img" and an aria-label', () => {
    const svg = el.querySelector<SVGSVGElement>('.chart svg')
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toBe('Applications per day, last 14 days')
  })

  it('renders 14 bar rects when data is set', () => {
    el.setData(sample())
    expect(el.querySelectorAll('.chart svg rect.bar').length).toBe(14)
  })

  it('renders 6 gridline/baseline elements', () => {
    el.setData(sample())
    const lines = el.querySelectorAll('.chart svg line')
    const gridLines = Array.from(lines).filter(l => l.classList.contains('grid'))
    const baseline = el.querySelectorAll('.chart svg line.baseline')
    expect(gridLines.length).toBe(5)
    expect(baseline.length).toBe(1)
  })

  it('renders 14 x-axis text labels', () => {
    el.setData(sample())
    expect(el.querySelectorAll('.chart svg text.axis-x').length).toBe(14)
  })

  it('renders weekend shading rects', () => {
    el.setData(sample())
    const weekends = el.querySelectorAll('.chart svg rect.weekend')
    expect(weekends.length).toBe(4)
  })

  it('renders an average line', () => {
    el.setData(sample())
    expect(el.querySelector('.chart svg line.avg-line')).not.toBeNull()
  })

  function yAxisLabels(): string[] {
    return Array.from(el.querySelectorAll<SVGTextElement>('.chart svg text.axis-y')).map(t => t.textContent ?? '')
  }

  it('labels the y-axis with real values when the data max exceeds 5', () => {
    const days = sample().days.map((d, i) => ({ day: d.day, count: i === 9 ? 10 : d.count }))
    el.setData({ days })
    expect(yAxisLabels()).toEqual(['0', '2', '4', '6', '8', '10'])
  })

  it('rounds y-axis labels to whole numbers at odd maxima', () => {
    const days = sample().days.map((d, i) => ({ day: d.day, count: i === 9 ? 7 : d.count }))
    el.setData({ days })
    expect(yAxisLabels().every(label => !label.includes('.'))).toBe(true)
    expect(yAxisLabels()).toEqual(['0', '1', '3', '4', '6', '7'])
  })

  it('keeps the 0–5 axis when the data max is at most 5', () => {
    el.setData(sample())
    expect(yAxisLabels()).toEqual(['0', '1', '2', '3', '4', '5'])
  })

  it('keeps the 0–5 axis in the empty state', () => {
    el.setData(null)
    expect(yAxisLabels()).toEqual(['0', '1', '2', '3', '4', '5'])
  })

  it('renders the chart legend as a sibling of .chart', () => {
    const legend = el.querySelector('.chart-legend')
    expect(legend).not.toBeNull()
    expect(legend?.previousElementSibling?.classList.contains('chart')).toBe(true)
  })

  it('sets data-empty when all counts are zero', () => {
    const zeros: ApplicationsChartData = {
      days: Array.from({ length: 14 }, (_, i) => ({
        day: `2026-08-${String(i + 6).padStart(2, '0')}`,
        count: 0,
      })),
    }
    el.setData(zeros)
    expect(el.querySelectorAll('.chart svg rect.bar').length).toBe(14)
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

  it('the tallest bar has the maximum height', () => {
    el.setData(sample())
    const bars = Array.from(el.querySelectorAll<SVGRectElement>('.chart svg rect.bar'))
    const heights = bars.map(r => parseFloat(r.getAttribute('height') ?? '0'))
    const maxIdx = heights.indexOf(Math.max(...heights))
    expect(heights[maxIdx]).toBeCloseTo(106.8)
  })

  it('each hit-rect has a title with day and count', () => {
    el.setData(sample())
    const hits = Array.from(el.querySelectorAll<SVGRectElement>('.chart svg rect.bar-hit'))
    const titles = hits.map(r => r.querySelector('title')?.textContent ?? '')
    expect(titles[2]).toContain('2 applications')
    expect(titles[4]).toContain('1 application')
    expect(titles[9]).toContain('3 applications')
  })
})
