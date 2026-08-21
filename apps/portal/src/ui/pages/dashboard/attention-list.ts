/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export interface AttentionItem {
  kind: string
  message: string
  detail: string
}

export class AttentionList extends HTMLElement {
  #data: AttentionItem[] | null = null

  setData(data: AttentionItem[] | null): void {
    this.#data = data
    this.#draw()
  }

  connectedCallback(): void {
    this.#draw()
  }

  #draw(): void {
    const items = this.#data ?? []
    const sub = items.length === 0 ? 'All clear' : `${items.length} item${items.length === 1 ? '' : 's'}`
    const rows = items.map(item => this.#rowHtml(item)).join('')

    this.innerHTML = `
      <div class="widget-head">
        <h2>Needs attention</h2>
        <span class="widget-sub">${sub}</span>
      </div>
      <div class="widget-body">
        ${items.length === 0 ? '<p class="attention-empty">Nothing needs your attention right now.</p>' : rows}
      </div>
    `
  }

  #rowHtml(item: AttentionItem): string {
    return `
      <div class="attention-row">
        <span class="attention-dot ${item.kind}"></span>
        <span class="attention-text">
          ${item.message}
          <span class="sub">${item.detail}</span>
        </span>
        <a class="attention-link" href="#queues">View queues &rarr;</a>
      </div>
    `
  }
}

customElements.define('attention-list', AttentionList)

declare global {
  interface HTMLElementTagNameMap {
    'attention-list': AttentionList
  }
}
