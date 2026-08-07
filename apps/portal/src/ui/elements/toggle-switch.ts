/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export interface ToggleSwitchEventMap {
  'toggle-switch:change': CustomEvent<{ checked: boolean }>
}

type ToggleSwitchAttribute = 'checked' | 'label'

export class ToggleSwitch extends HTMLElement {
  static observedAttributes: ToggleSwitchAttribute[] = ['checked', 'label']

  #checked = false
  #label = ''
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  attributeChangedCallback(name: ToggleSwitchAttribute, _oldValue: string | null, newValue: string | null): void {
    switch (name) {
      case 'checked':
        this.#checked = newValue !== null
        break
      case 'label':
        this.#label = newValue ?? ''
        break
    }
    this.render()
  }

  get checked(): boolean {
    return this.#checked
  }

  set checked(value: boolean) {
    this.toggleAttribute('checked', value)
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('change', this.#onChange, opts)
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement
    if (input.type !== 'checkbox') {
      return
    }
    this.toggleAttribute('checked', input.checked)
    this.dispatchEvent(
      new CustomEvent('toggle-switch:change', {
        bubbles: true,
        composed: true,
        detail: { checked: input.checked },
      })
    )
  }

  render(): void {
    if (!this.isConnected) {
      return
    }
    this.innerHTML = `
      <label class="switch">
        <input type="checkbox" aria-label="${this.#escapeAttr(this.#label)}"${this.#checked ? ' checked' : ''} />
        <span class="track"></span>
      </label>
    `
  }

  #escapeAttr(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

customElements.define('toggle-switch', ToggleSwitch)

declare global {
  interface HTMLElementTagNameMap {
    'toggle-switch': ToggleSwitch
  }
}
