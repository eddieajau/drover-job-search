/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { ApplicationDay, ApplicationsChart as ApplicationsChartData } from '../../../shared/types.js'

const SLOT_COUNT = 14

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
      <main class="page">
        <div class="page-head">
          <h1>Applications this month</h1>
        </div>
        <div class="chart">
          <svg viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label="Applications per day, last 14 days">
          </svg>
        </div>
      </main>
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

    const slotWidth = 600 / SLOT_COUNT
    const barHeight = 140
    const yMax = 140

    const bars = Array.from({ length: SLOT_COUNT }, (_, i) => {
      const day = this.#data[i]
      const count = day?.count ?? 0
      const normalisedMax = Math.max(max, 1)
      const height = (count / normalisedMax) * barHeight
      const y = yMax - height
      const dayLabel = day?.day ?? ''
      const title = dayLabel ? `${dayLabel}: ${count} applications` : `${count} applications`

      return `<rect x="${i * slotWidth}" y="${y}" width="${slotWidth}" height="${height}" fill="var(--accent)">
        <title>${title}</title>
      </rect>`
    })

    svg.innerHTML = bars.join('')
  }
}

customElements.define('applications-chart', ApplicationsChart)

declare global {
  interface HTMLElementTagNameMap {
    'applications-chart': ApplicationsChart
  }
}
