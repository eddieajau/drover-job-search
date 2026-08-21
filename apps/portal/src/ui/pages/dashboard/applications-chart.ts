/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { ApplicationDay, ApplicationsChart as ApplicationsChartData } from '../../../shared/types.js'

const SLOT_COUNT = 14
const PLOT_X = 34
const PLOT_WIDTH = 600
const PLOT_Y = 16
const PLOT_HEIGHT = 178
const PLOT_BOTTOM = PLOT_Y + PLOT_HEIGHT
const SLOT_WIDTH = PLOT_WIDTH / SLOT_COUNT
const BAR_WIDTH = 24
// Five intervals above zero; labels are derived from yMax, not these steps.
const TICK_STEPS = [0, 1, 2, 3, 4, 5]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function yForValue(value: number, yMax: number): number {
  if (yMax === 0) return PLOT_BOTTOM
  return PLOT_BOTTOM - (value / yMax) * PLOT_HEIGHT
}

function yTickY(tick: number): number {
  return PLOT_BOTTOM - tick * (PLOT_HEIGHT / 5)
}

// Value on the bar scale at a gridline, rounded half up so labels stay whole.
function tickValue(step: number, yMax: number): number {
  return Math.round((step / 5) * yMax)
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isWeekend(date: Date): boolean {
  const dow = date.getDay()
  return dow === 0 || dow === 6
}

function formatLabel(date: Date, isFirst: boolean): string {
  if (isFirst) {
    return `${MONTHS[date.getMonth()]} ${date.getDate()}`
  }
  return `${date.getDate()}`
}

function isToday(iso: string, today: string): boolean {
  return iso === today
}

export class ApplicationsChart extends HTMLElement {
  #data: ApplicationDay[] = []
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.#setupListeners()
  }

  disconnectedCallback(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  setData(chart: ApplicationsChartData | null): void {
    this.#data = chart?.days ?? []
    this.#draw()
  }

  render(): void {
    this.innerHTML = `
      <div class="chart">
        <svg viewBox="0 0 640 220" role="img" aria-label="Applications per day, last 14 days">
        </svg>
      </div>
      <div class="chart-legend">
        <span class="swatch"><span class="swatch-bar"></span>Applications</span>
        <span class="swatch"><span class="swatch-avg"></span>Daily avg</span>
        <span class="swatch"><span class="swatch-weekend"></span>Weekend</span>
      </div>
    `
    this.#draw()
  }

  #setupListeners(): void {
    this.#abort = new AbortController()
  }

  #draw(): void {
    const svg = this.querySelector<SVGSVGElement>('.chart svg')
    if (!svg) return

    const max = Math.max(...this.#data.map(d => d.count), 0)

    if (max === 0) {
      this.setAttribute('data-empty', '')
    } else {
      this.removeAttribute('data-empty')
    }

    const yMax = max <= 5 ? 5 : max
    const today = new Date().toISOString().slice(0, 10)
    const total = this.#data.reduce((sum, d) => sum + d.count, 0)
    const avgY = yForValue(total / SLOT_COUNT, yMax)

    const parts: string[] = []

    // Gridlines + baseline
    for (const step of TICK_STEPS) {
      const y = yTickY(step)
      const cls = step === 0 ? 'baseline' : 'grid'
      parts.push(`<line class="${cls}" x1="${PLOT_X}" y1="${y}" x2="${PLOT_X + PLOT_WIDTH}" y2="${y}"/>`)
    }

    // Y-axis labels
    for (const step of TICK_STEPS) {
      const y = yTickY(step)
      parts.push(
        `<text class="axis-y" x="${PLOT_X - 6}" y="${y + 4}" text-anchor="end">${tickValue(step, yMax)}</text>`
      )
    }

    // Weekend shading
    for (let i = 0; i < SLOT_COUNT; i++) {
      const day = this.#data[i]
      if (!day) continue
      const date = parseDate(day.day)
      if (isWeekend(date)) {
        const x = PLOT_X + i * SLOT_WIDTH
        parts.push(`<rect class="weekend" x="${x}" y="${PLOT_Y}" width="${SLOT_WIDTH}" height="${PLOT_HEIGHT}"/>`)
      }
    }

    // Average line
    parts.push(`<line class="avg-line" x1="${PLOT_X}" y1="${avgY}" x2="${PLOT_X + PLOT_WIDTH}" y2="${avgY}"/>`)

    // Bars, labels, hit-rects, x-axis labels
    for (let i = 0; i < SLOT_COUNT; i++) {
      const day = this.#data[i]
      const count = day?.count ?? 0
      const height = yMax > 0 ? (count / yMax) * PLOT_HEIGHT : 0
      const y = PLOT_BOTTOM - height
      const slotX = PLOT_X + i * SLOT_WIDTH
      const barX = slotX + (SLOT_WIDTH - BAR_WIDTH) / 2
      const dayLabel = day?.day ?? ''
      const date = day ? parseDate(day.day) : null
      const todayFlag = dayLabel ? isToday(dayLabel, today) : false
      const labelText = date ? formatLabel(date, i === 0) : ''

      // Bar
      parts.push(`<rect class="bar" x="${barX}" y="${y}" width="${BAR_WIDTH}" height="${height}" rx="3"/>`)

      // Bar value label
      if (count > 0) {
        parts.push(
          `<text class="bar-value" x="${barX + BAR_WIDTH / 2}" y="${y - 4}" text-anchor="middle">${count}</text>`
        )
      }

      // Hit-rect with tooltip
      const titleText = dayLabel
        ? `${new Date(dayLabel).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}: ${count} application${count === 1 ? '' : 's'}`
        : `${count} application${count === 1 ? '' : 's'}`
      parts.push(
        `<rect class="bar-hit" x="${slotX}" y="${PLOT_Y}" width="${SLOT_WIDTH}" height="${PLOT_HEIGHT}"><title>${titleText}</title></rect>`
      )

      // X-axis label
      const cls = todayFlag ? 'axis-x today' : 'axis-x'
      parts.push(
        `<text class="${cls}" x="${slotX + SLOT_WIDTH / 2}" y="${PLOT_BOTTOM + 16}" text-anchor="middle">${labelText}</text>`
      )
    }

    svg.innerHTML = parts.join('')
  }
}

customElements.define('applications-chart', ApplicationsChart)

declare global {
  interface HTMLElementTagNameMap {
    'applications-chart': ApplicationsChart
  }
}
