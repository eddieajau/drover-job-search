/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { escapeHtml as esc } from '../../escape.js'

export interface FactIngestPageEventMap {
  'fact-ingest-page:ready': CustomEvent<void>
  'fact-ingest-page:ingest': CustomEvent<{ resume: string }>
}

export class FactIngestPage extends HTMLElement {
  #busy = false
  #result: { inserted: number } | { error: string } | null = null
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
    this.dispatchEvent(new CustomEvent('fact-ingest-page:ready', { bubbles: true, composed: true }))
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setBusy(busy: boolean): void {
    this.#busy = busy
    this.render()
  }

  setResult(result: { inserted: number } | { error: string }): void {
    this.#result = result
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

  #onClick = (event: MouseEvent): void => {
    if ((event.target as HTMLElement).closest('#btn-ingest')) {
      this.#onIngest()
    }
  }

  #onIngest(): void {
    const textarea = this.querySelector<HTMLTextAreaElement>('#ingest-resume')
    if (!textarea) {
      return
    }
    const resume = textarea.value.trim()
    if (!resume) {
      return
    }
    this.dispatchEvent(
      new CustomEvent('fact-ingest-page:ingest', {
        bubbles: true,
        composed: true,
        detail: { resume },
      })
    )
  }

  render(): void {
    this.classList.add('fact-ingest-page')
    const resumeValue = this.querySelector<HTMLTextAreaElement>('#ingest-resume')?.value ?? ''

    let resultBanner = ''
    if (this.#result != null) {
      if ('inserted' in this.#result) {
        resultBanner = `<div class="ingest-result success" role="status">Inserted ${this.#result.inserted} facts. <a href="#facts">View facts</a></div>`
      } else {
        resultBanner = `<div class="ingest-result error" role="status">${esc(this.#result.error)}</div>`
      }
    }

    this.innerHTML = `
      <main class="page">
        <a class="crumb" href="#facts">\u2190 Facts</a>
        <h1>Import resume</h1>
        <form class="form">
          <div class="field">
            <label class="field-label req" for="ingest-resume">Resume text</label>
            <textarea class="input" id="ingest-resume" rows="16" placeholder="Paste your resume as plain text\u2026">${esc(resumeValue)}</textarea>
            <p class="hint">The LLM slices this into fact rows. Sync call \u2014 may take a while.</p>
          </div>
          <div class="form-actions">
            <button type="button" class="btn primary" id="btn-ingest"${this.#busy ? ' disabled aria-busy="true"' : ''}>${this.#busy ? 'Ingesting\u2026' : 'Ingest'}</button>
            <a class="btn" href="#facts">Cancel</a>
          </div>
        </form>
        ${resultBanner}
      </main>
    `
  }
}

customElements.define('fact-ingest-page', FactIngestPage)

declare global {
  interface HTMLElementTagNameMap {
    'fact-ingest-page': FactIngestPage
  }
}
