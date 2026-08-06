/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { escapeHtml as esc } from '../../escape.js'
import type { JobWithStatus } from '../../jobs-view.js'

export class JobDetail extends HTMLElement {
  #job: JobWithStatus | null = null

  connectedCallback(): void {
    this.render()
  }

  showJob(job: JobWithStatus | null): void {
    this.#job = job
    this.render()
  }

  render(): void {
    if (!this.#job) {
      this.innerHTML = '<article class="detail detail-empty"><p>Select a job to view details</p></article>'
      return
    }
    const job = this.#job
    const status = job._status
    this.innerHTML = `
      <article class="detail">
        <header class="detail-head">
          <h2>${esc(job.title)}</h2>
          <div class="detail-company">${esc(job.companyName)}</div>
          <div class="detail-meta">
            <span class="chip chip-p${job.priority}">P${job.priority}</span>
            <span class="chip">${esc(job.category)}</span>
            <span class="chip">${esc(job.location)}</span>
            <span class="chip">Posted ${esc(job.postedAt ?? 'unknown')}</span>
            ${status !== 'new' ? `<span class="chip chip-${esc(status)}">${esc(status)}</span>` : ''}
          </div>
        </header>
        <div class="job-desc">
          ${job.descriptionHtml ?? '<em>No description in search results.</em>'}
        </div>
      </article>
    `
  }
}

customElements.define('job-detail', JobDetail)

declare global {
  interface HTMLElementTagNameMap {
    'job-detail': JobDetail
  }
}
