/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export interface QueueHealthData {
  pending: { fetch_job_details: number; rank: number }
  done: number
  total: number
}

export class QueueHealth extends HTMLElement {
  #data: QueueHealthData | null = null

  setData(data: QueueHealthData | null): void {
    this.#data = data
    this.#draw()
  }

  connectedCallback(): void {
    this.#draw()
  }

  #draw(): void {
    const d = this.#data
    if (!d) {
      this.innerHTML = `
        <div class="widget-head">
          <h2>Queues</h2>
        </div>
        <div class="widget-body">
          <div class="mini-row">
            <span class="mini-label">Rank pending</span>
            <span class="mini-value">—</span>
          </div>
          <div class="mini-row">
            <span class="mini-label">Fetch details pending</span>
            <span class="mini-value">—</span>
          </div>
          <div class="mini-row">
            <span class="mini-label">Completed, last 7d</span>
            <span class="mini-value">—</span>
          </div>
          <div class="mini-row">
            <span class="mini-label">Total processed</span>
            <span class="mini-value">—</span>
          </div>
        </div>
      `
      return
    }

    const healthy = d.pending.fetch_job_details === 0 && d.pending.rank === 0
    const chipClass = healthy ? 'health-chip healthy' : 'health-chip busy'
    const chipText = healthy ? 'Healthy' : 'Busy'

    this.innerHTML = `
      <div class="widget-head">
        <h2>Queues</h2>
        <span class="${chipClass}">${chipText}</span>
      </div>
      <div class="widget-body">
        <div class="mini-row">
          <span class="mini-label">Rank pending</span>
          <span class="mini-value">${d.pending.rank}</span>
        </div>
        <div class="mini-row">
          <span class="mini-label">Fetch details pending</span>
          <span class="mini-value">${d.pending.fetch_job_details}</span>
        </div>
        <div class="mini-row">
          <span class="mini-label">Completed, last 7d</span>
          <span class="mini-value">${d.done}</span>
        </div>
        <div class="mini-row">
          <span class="mini-label">Total processed</span>
          <span class="mini-value">${d.total}</span>
        </div>
      </div>
    `
  }
}

customElements.define('queue-health', QueueHealth)

declare global {
  interface HTMLElementTagNameMap {
    'queue-health': QueueHealth
  }
}
