/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { escapeHtml as esc } from '../../escape.js'

export interface EvalWhy {
  strengths: string[]
  gaps: string[]
}

type AiEvalBoxAttribute = 'verdict' | 'score' | 'why' | 'gated'

export class AiEvalBox extends HTMLElement {
  static observedAttributes: AiEvalBoxAttribute[] = ['verdict', 'score', 'why', 'gated']

  #verdict = ''
  #score: number | undefined = undefined
  #why = ''
  #gated = false
  #whyLists: EvalWhy | null = null

  connectedCallback(): void {
    this.render()
  }

  setWhy(why: EvalWhy | null): void {
    this.#whyLists = why
    if (this.isConnected) {
      this.render()
    }
  }

  attributeChangedCallback(name: AiEvalBoxAttribute, _oldValue: string | null, newValue: string | null): void {
    switch (name) {
      case 'verdict':
        this.#verdict = newValue ?? ''
        break
      case 'score':
        this.#score = newValue !== null ? Number(newValue) : undefined
        break
      case 'why':
        this.#why = newValue ?? ''
        break
      case 'gated':
        this.#gated = newValue !== null
        break
    }
    if (this.isConnected) {
      this.render()
    }
  }

  render(): void {
    const hasVerdict = this.#verdict !== ''
    const hasScore = this.#gated || this.#score !== undefined

    if (!hasVerdict && !hasScore) {
      this.innerHTML = `<p class="eval-empty">No evaluation yet.</p>`
      return
    }

    const scoreBand = this.#gated ? 'score-low' : (this.#score ?? 0) >= 50 ? 'score-high' : 'score-mid'
    const scoreLabel = this.#gated ? 'auto-skip' : this.#score !== undefined ? `${this.#score}` : ''

    const whyListsHtml = this.#whyLists
      ? `
        <div class="eval-why-lists">
          ${
            this.#whyLists.strengths.length > 0
              ? `
            <div class="eval-why-block">
              <span class="eval-why-label">Strengths</span>
              <ul>${this.#whyLists.strengths.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
            </div>`
              : ''
          }
          ${
            this.#whyLists.gaps.length > 0
              ? `
            <div class="eval-why-block">
              <span class="eval-why-label">Gaps</span>
              <ul>${this.#whyLists.gaps.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
            </div>`
              : ''
          }
        </div>`
      : ''

    this.innerHTML = `
      <div class="eval-box">
        <div class="eval-head">
          <span class="eval-verdict">${esc(this.#verdict)}</span>
          <span class="score ${scoreBand}">${esc(scoreLabel)}</span>
        </div>
        <p class="eval-why">${esc(this.#why)}</p>
        ${whyListsHtml}
      </div>
    `
  }
}

customElements.define('ai-eval-box', AiEvalBox)

declare global {
  interface HTMLElementTagNameMap {
    'ai-eval-box': AiEvalBox
  }
}
