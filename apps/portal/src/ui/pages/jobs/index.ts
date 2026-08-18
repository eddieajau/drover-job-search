/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Pager } from '../../elements/pager.js'
import '../../elements/pager.js'
import type { JobsViewState, JobWithStatus } from '../../jobs-view.js'
import './filter-bar.js'
import type { FilterBar } from './filter-bar.js'
import './job-list.js'
import type { JobDetail } from './job-detail.js'
import './job-detail.js'
import type { JobList } from './job-list.js'
import './job-meta-panel.js'
import type { JobMetaPanel } from './job-meta-panel.js'
import './job-stats.js'
import type { JobStats } from './job-stats.js'

export interface JobsPageEventMap {
  'jobs-page:ready': CustomEvent<void>
}

export class JobsPage extends HTMLElement {
  #abort: AbortController | null = null
  #state: JobsViewState | null = null
  #announcedSelectionId: number | null = null

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
    this.#state = state
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
      this.#metaPanel()?.showJob(null, [], false)
      this.#announcedSelectionId = null
    } else {
      const selectedJob = state.all.find(job => job.id === state.selectedId)
      if (selectedJob) {
        this.#metaPanel()?.showJob(selectedJob, [], selectedJob.queued ?? false)
        if (this.#announcedSelectionId !== state.selectedId) {
          this.#announcedSelectionId = state.selectedId
          this.dispatchEvent(
            new CustomEvent('jobs-page:selected', {
              bubbles: true,
              composed: true,
              detail: { jobId: selectedJob.id },
            })
          )
        }
      }
    }
  }

  setJobMeta(jobId: number, signals: import('../../../shared/types.js').JobSignal[], queued: boolean): void {
    const selectedJob = this.#findSelectedJob()
    if (selectedJob && selectedJob.id === jobId) {
      this.#metaPanel()?.showJob(selectedJob, signals, queued)
    }
  }

  #findSelectedJob(): JobWithStatus | null {
    if (!this.#state?.selectedId) {
      return null
    }
    return this.#state.all.find(job => job.id === this.#state!.selectedId) ?? null
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

  #metaPanel(): JobMetaPanel | null {
    return this.querySelector('job-meta-panel')
  }

  render(): void {
    this.innerHTML = `
      <div class="jobs-page">
        <div class="workspace">
          <aside class="pane-list" aria-label="Jobs list">
            <div class="list-toolbar">
              <filter-bar></filter-bar>
            </div>
            <job-list></job-list>
            <div class="pane-foot">
              <pager-nav></pager-nav>
              <job-stats></job-stats>
            </div>
          </aside>
          <main class="pane-content">
            <job-detail></job-detail>
          </main>
          <aside class="pane-meta" aria-label="Job signals and actions">
            <job-meta-panel></job-meta-panel>
          </aside>
        </div>
      </div>
    `
  }

  setupEventListeners(): void {
    this.cleanup()
    this.#abort = new AbortController()
  }

  cleanup(): void {
    this.#abort?.abort()
    this.#abort = null
  }
}

customElements.define('jobs-page', JobsPage)

declare global {
  interface HTMLElementTagNameMap {
    'jobs-page': JobsPage
  }
}
