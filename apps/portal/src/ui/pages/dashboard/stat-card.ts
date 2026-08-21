/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export interface StatCardDelta {
  value: number
  direction: 'up' | 'down'
}

export interface StatCardData {
  label: string
  value: string | number
  note?: string
  delta?: StatCardDelta
  needsAction?: boolean
}

function formatDelta(delta: StatCardDelta): string {
  return `${delta.direction === 'up' ? '+' : '-'}${Math.abs(delta.value)}`
}

export class StatCard extends HTMLElement {
  #data: StatCardData | null = null

  connectedCallback(): void {
    this.#draw()
  }

  setData(data: StatCardData): void {
    this.#data = data
    this.#draw()
  }

  #draw(): void {
    const d = this.#data
    this.className = 'widget-body stat-card'
    this.classList.toggle('needs-action', d?.needsAction === true)

    const deltaHtml = d?.delta ? `<span class="stat-delta ${d.delta.direction}">${formatDelta(d.delta)}</span>` : ''
    const noteHtml = d?.note ? `<span class="stat-note">${d.note}</span>` : ''

    this.innerHTML = `
      <span class="stat-label">${d?.label ?? ''}</span>
      <span class="stat-topline">
        <span class="stat-value">${d?.value ?? ''}</span>
        ${deltaHtml}
      </span>
      ${noteHtml}
    `
  }
}

customElements.define('stat-card', StatCard)

declare global {
  interface HTMLElementTagNameMap {
    'stat-card': StatCard
  }
}
