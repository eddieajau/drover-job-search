/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export interface PipelineData {
  applied: number
  interviewing: number
  successful: number
  unsuccessful: number
  declined: number
}

interface FunnelStage {
  label: string
  key: keyof PipelineData
  fillClass: string
}

const ACTIVE_STAGES: readonly FunnelStage[] = [
  { label: 'Applied', key: 'applied', fillClass: 'applied' },
  { label: 'Interviewing', key: 'interviewing', fillClass: 'interviewing' },
  { label: 'Successful', key: 'successful', fillClass: 'successful' },
]

const CLOSED_STAGES: readonly FunnelStage[] = [
  { label: 'Unsuccessful', key: 'unsuccessful', fillClass: 'outcome' },
  { label: 'Declined', key: 'declined', fillClass: 'outcome' },
]

export class PipelineFunnel extends HTMLElement {
  #data: PipelineData | null = null

  connectedCallback(): void {
    this.#draw()
  }

  setData(data: PipelineData | null): void {
    this.#data = data
    this.#draw()
  }

  #draw(): void {
    const d = this.#data
    // All bars share one scale: the largest active stage, so closed outcomes
    // stay visually comparable to the funnel above them.
    const max = d ? Math.max(d.applied, d.interviewing, d.successful) : 0

    this.innerHTML = `
      <div class="widget-head">
        <h2>Pipeline</h2>
        <span class="widget-sub">Active applications</span>
      </div>
      <div class="widget-body">
        ${ACTIVE_STAGES.map(stage => this.#rowHtml(stage, max)).join('')}
        <div class="funnel-divider">Closed</div>
        ${CLOSED_STAGES.map(stage => this.#rowHtml(stage, max)).join('')}
        <p class="funnel-note">${this.#noteText()}</p>
      </div>
    `
  }

  #rowHtml(stage: FunnelStage, max: number): string {
    const d = this.#data
    const width = d && max > 0 ? Math.round((d[stage.key] / max) * 100) : 0
    return `
      <div class="funnel-row">
        <span class="funnel-label">${stage.label}</span>
        <span class="funnel-track"><span class="funnel-fill ${stage.fillClass}" style="width: ${width}%"></span></span>
        <span class="funnel-count">${d ? d[stage.key] : '—'}</span>
      </div>
    `
  }

  #noteText(): string {
    const d = this.#data
    if (!d) return 'Applied → interviewing — · Interviewing → successful —'
    return (
      `Applied → interviewing ${this.#rate(d.interviewing, d.applied)}` +
      ` · Interviewing → successful ${this.#rate(d.successful, d.interviewing)}`
    )
  }

  #rate(part: number, whole: number): string {
    return whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`
  }
}

customElements.define('pipeline-funnel', PipelineFunnel)

declare global {
  interface HTMLElementTagNameMap {
    'pipeline-funnel': PipelineFunnel
  }
}
