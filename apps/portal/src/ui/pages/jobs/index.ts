/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Pager } from '../../elements/pager.js'
import '../../elements/pager.js'
import type { JobsViewState } from '../../jobs-view.js'
import './filter-bar.js'
import type { FilterBar } from './filter-bar.js'
import './job-list.js'
import type { JobDetail } from './job-detail.js'
import './job-detail.js'
import type { JobList } from './job-list.js'
import './job-stats.js'
import type { JobSignalsPanel } from './job-signals-panel.js'
import './job-signals-panel.js'
import type { JobStats } from './job-stats.js'

export interface JobsPageEventMap {
  'jobs-page:ready': CustomEvent<void>
  'jobs-page:search': CustomEvent<void>
}

export class JobsPage extends HTMLElement {
  #abort: AbortController | null = null

  connectedCallback(): void {
    this.render()
    this.setupEventListeners()
    this.dispatchEvent(new CustomEvent('jobs-page:ready', { bubbles: true, composed: true }))
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  setLoading(): void {
    this.#list()?.setState({ status: 'loading', message: '', jobs: [], selectedId: null })
  }

  setError(message: string): void {
    this.#list()?.setState({ status: 'error', message, jobs: [], selectedId: null })
  }

  setState(state: JobsViewState): void {
    this.#list()?.setState({
      status: state.status,
      message: state.message,
      jobs: state.jobs,
      selectedId: state.selectedId,
    })
    this.#stats()?.setStats(state.all.length, state.all.filter(job => job._status === 'new').length)
    this.#detail()?.showJob(state.selectedId ? (state.all.find(job => job.id === state.selectedId) ?? null) : null)
    this.#filter()?.setFilters(state.filters)
    this.#pager()?.setAttribute('page', String(state.page))
    this.#pager()?.setAttribute('page-size', String(state.pageSize))
    this.#pager()?.setAttribute('total', String(state.total))
    if (!state.selectedId) {
      this.#signalsPanel()?.showSignals(null, [], false)
    }
  }

  setJobSignals(providerJobId: string, signals: import('../../../shared/types.js').JobSignal[], queued: boolean): void {
    this.#signalsPanel()?.showSignals(providerJobId, signals, queued)
  }

  #list(): JobList | null {
    return this.querySelector('job-list')
  }

  #detail(): JobDetail | null {
    return this.querySelector('job-detail')
  }

  #stats(): JobStats | null {
    return this.querySelector('job-stats')
  }

  #filter(): FilterBar | null {
    return this.querySelector('filter-bar')
  }

  #pager(): Pager | null {
    return this.querySelector('pager-nav')
  }

  #signalsPanel(): JobSignalsPanel | null {
    return this.querySelector('job-signals-panel')
  }

  render(): void {
    this.innerHTML = `
      <div class="jobs-page">
        <div class="jobs-toolbar">
          <job-stats></job-stats>
          <filter-bar></filter-bar>
          <button type="button" id="btn-search">Search</button>
        </div>
        <div class="layout">
          <div class="list-panel">
            <job-list></job-list>
            <pager-nav></pager-nav>
          </div>
          <div class="detail-panel">
            <job-detail></job-detail>
            <job-signals-panel></job-signals-panel>
          </div>
        </div>
      </div>
    `
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
    const opts = { signal: this.#abort.signal }
    this.querySelector('#btn-search')?.addEventListener('click', this.#onSearch, opts)
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }

  #onSearch = (): void => {
    this.dispatchEvent(new CustomEvent('jobs-page:search', { bubbles: true, composed: true }))
  }
}

customElements.define('jobs-page', JobsPage)

declare global {
  interface HTMLElementTagNameMap {
    'jobs-page': JobsPage
  }
}
