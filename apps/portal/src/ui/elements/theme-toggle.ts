/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export interface ThemeToggleEventMap {
  'theme-toggle:requesttoggle': CustomEvent<{ current: 'light' | 'dark' }>
}

type ThemeToggleAttribute = 'theme'

export class ThemeToggle extends HTMLElement {
  static observedAttributes: ThemeToggleAttribute[] = ['theme']

  #theme: 'light' | 'dark' = 'light'
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  attributeChangedCallback(name: ThemeToggleAttribute, _oldValue: string | null, newValue: string | null): void {
    if (name === 'theme') {
      this.#theme = newValue === 'dark' ? 'dark' : 'light'
    }
    this.render()
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('click', this.#onClick, opts)
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onClick = (): void => {
    this.dispatchEvent(
      new CustomEvent('theme-toggle:requesttoggle', {
        bubbles: true,
        composed: true,
        detail: { current: this.#theme },
      })
    )
  }

  render(): void {
    if (!this.isConnected) {
      return
    }
    const isDark = this.#theme === 'dark'
    this.innerHTML = `
      <button type="button" class="btn btn-ghost theme-toggle"
        aria-pressed="${isDark ? 'true' : 'false'}">${isDark ? 'Light mode' : 'Dark mode'}</button>
    `
  }
}

customElements.define('theme-toggle', ThemeToggle)

declare global {
  interface HTMLElementTagNameMap {
    'theme-toggle': ThemeToggle
  }
}
