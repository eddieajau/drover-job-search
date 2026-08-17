/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { escapeHtml as esc } from '../../escape.js'

export interface ImportPageEventMap {
  'import-page:ready': CustomEvent<void>
  'import-page:save': CustomEvent<{ url: string; status: string; date: string }>
}

export class ImportPage extends HTMLElement {
  #busy = false
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
    this.dispatchEvent(new CustomEvent('import-page:ready', { bubbles: true, composed: true }))
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setBusy(busy: boolean): void {
    this.#busy = busy
    const btn = this.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (!btn) {
      return
    }
    btn.disabled = busy
    if (busy) {
      btn.setAttribute('aria-busy', 'true')
      btn.textContent = 'Importing…'
    } else {
      btn.removeAttribute('aria-busy')
      btn.textContent = 'Import'
    }
  }

  setDate(date: string): void {
    const input = this.querySelector<HTMLInputElement>('#import-date')
    if (input) {
      input.value = date
    }
  }

  showSuccess(title: string): void {
    const result = this.querySelector<HTMLElement>('#import-result')
    if (result) {
      result.innerHTML = `<div class="ingest-result success" role="status">Imported "${esc(title)}". <a href="#jobs">View jobs</a></div>`
    }
  }

  showError(message: string): void {
    const result = this.querySelector<HTMLElement>('#import-result')
    if (result) {
      result.innerHTML = `<div class="ingest-result error" role="status">${esc(message)}</div>`
    }
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.addEventListener('submit', this.#onSubmit, opts)
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onSubmit = (event: Event): void => {
    event.preventDefault()
    const form = event.target as HTMLFormElement
    const url = (form.querySelector<HTMLInputElement>('#import-url')?.value ?? '').trim()
    const status = form.querySelector<HTMLSelectElement>('#import-status')?.value ?? 'applied'
    const date = form.querySelector<HTMLInputElement>('#import-date')?.value ?? ''

    if (!url) {
      return
    }

    this.dispatchEvent(
      new CustomEvent('import-page:save', {
        bubbles: true,
        composed: true,
        detail: { url, status, date },
      })
    )
  }

  render(): void {
    this.innerHTML = `
      <main class="page">
        <h1>Import Job</h1>
        <form id="import-form" class="form">
          <div class="field">
            <label class="field-label req" for="import-url">Job URL</label>
            <input class="input" type="url" id="import-url" placeholder="https://au.seek.com/job/… or https://www.linkedin.com/jobs/view/…"
                   required pattern="https?://au\\.seek\\.com/job/\\d+|https?://(?:[a-z]{2,}\\.)?linkedin\\.com/jobs/view/\\d+/?" />
          </div>
          <div class="field">
            <label class="field-label req" for="import-status">Starting Status</label>
            <select class="input" id="import-status">
              <option value="applied" selected>Applied</option>
              <option value="interviewing">Interviewing</option>
              <option value="skipped">Skipped</option>
              <option value="blocked">Blocked</option>
              <option value="declined">Declined</option>
              <option value="unsuccessful">Unsuccessful</option>
              <option value="successful">Successful</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="import-date">Date</label>
            <input class="input" type="date" id="import-date" />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn primary"${this.#busy ? ' disabled aria-busy="true"' : ''}>${this.#busy ? 'Importing\u2026' : 'Import'}</button>
            <a class="btn" href="#jobs">Cancel</a>
          </div>
        </form>
        <div id="import-result"></div>
      </main>
    `
  }
}

customElements.define('import-page', ImportPage)

declare global {
  interface HTMLElementTagNameMap {
    'import-page': ImportPage
  }
}
