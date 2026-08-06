/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export interface PagerEventMap {
  'pager:change': CustomEvent<{ page: number; pageSize: number }>
}

type PagerAttribute = 'page' | 'page-size' | 'total'

export class Pager extends HTMLElement {
  static observedAttributes: PagerAttribute[] = ['page', 'page-size', 'total']

  #page = 1
  #pageSize = 50
  #total = 0
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  attributeChangedCallback(name: PagerAttribute, _oldValue: string | null, newValue: string | null): void {
    switch (name) {
      case 'page':
        this.#page = this.#toInt(newValue, 1)
        break
      case 'page-size':
        this.#pageSize = this.#toInt(newValue, 50)
        break
      case 'total':
        this.#total = this.#toInt(newValue, 0)
        break
    }
    this.render()
  }

  #toInt(value: string | null, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.#total / this.#pageSize))
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('click', this.#onClick, opts)
    this.addEventListener('change', this.#onChange, opts)
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement
    if (target.closest('#pager-prev')) {
      this.#go(this.#page - 1)
    } else if (target.closest('#pager-next')) {
      this.#go(this.#page + 1)
    }
  }

  #onChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement
    if (target.id !== 'pager-size') {
      return
    }
    const pageSize = Number(target.value)
    this.#dispatchChange(1, pageSize)
  }

  #go(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages)
    if (clamped === this.#page) {
      return
    }
    this.#dispatchChange(clamped, this.#pageSize)
  }

  #dispatchChange(page: number, pageSize: number): void {
    this.dispatchEvent(
      new CustomEvent('pager:change', {
        bubbles: true,
        composed: true,
        detail: { page, pageSize },
      })
    )
  }

  render(): void {
    if (!this.isConnected) {
      return
    }
    const page = Math.min(Math.max(this.#page, 1), this.totalPages)
    const prevDisabled = page <= 1 ? 'disabled' : ''
    const nextDisabled = page >= this.totalPages ? 'disabled' : ''
    this.innerHTML = `
      <button type="button" id="pager-prev" ${prevDisabled}>&lsaquo;</button>
      <span class="pager-info">Page ${page} of ${this.totalPages}</span>
      <button type="button" id="pager-next" ${nextDisabled}>&rsaquo;</button>
      <select id="pager-size" aria-label="Items per page">
        ${[10, 25, 50]
          .map(size => `<option value="${size}"${size === this.#pageSize ? ' selected' : ''}>${size}</option>`)
          .join('')}
      </select>
    `
  }
}

customElements.define('pager-nav', Pager)

declare global {
  interface HTMLElementTagNameMap {
    'pager-nav': Pager
  }
}
