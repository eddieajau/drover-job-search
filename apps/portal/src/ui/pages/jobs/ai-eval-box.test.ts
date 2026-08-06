/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import './ai-eval-box.js'
import type { AiEvalBox } from './ai-eval-box.js'

function createBox(attrs: Record<string, string> = {}): AiEvalBox {
  const box = document.createElement('ai-eval-box') as AiEvalBox
  for (const [key, value] of Object.entries(attrs)) {
    box.setAttribute(key, value)
  }
  document.body.appendChild(box)
  return box
}

describe('ai-eval-box', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders verdict, score chip, and why from attributes', () => {
    const box = createBox({
      verdict: 'High match',
      score: '85',
      why: 'Strong alignment with required skills.',
    })

    const verdict = box.querySelector('.eval-verdict')
    expect(verdict?.textContent).toBe('High match')

    const score = box.querySelector('.score')
    expect(score?.classList.contains('score-high')).toBe(true)
    expect(score?.textContent).toBe('85')

    const why = box.querySelector('.eval-why')
    expect(why?.textContent).toBe('Strong alignment with required skills.')
  })

  it('renders auto-skip for gated jobs', () => {
    const box = createBox({
      verdict: 'Auto-skip',
      gated: '',
      why: 'Blocked by dealbreaker rule.',
    })

    const score = box.querySelector('.score')
    expect(score?.classList.contains('score-low')).toBe(true)
    expect(score?.textContent).toBe('auto-skip')
  })

  it('renders empty state when no verdict or score', () => {
    const box = createBox({})

    const empty = box.querySelector('.eval-empty')
    expect(empty?.textContent).toBe('No evaluation yet.')
    expect(box.querySelector('.eval-box')).toBeNull()
  })

  it('re-renders when score attribute changes', () => {
    const box = createBox({
      verdict: 'Moderate match',
      score: '30',
      why: 'Some alignment.',
    })

    let score = box.querySelector('.score')
    expect(score?.classList.contains('score-mid')).toBe(true)
    expect(score?.textContent).toBe('30')

    box.setAttribute('score', '85')
    score = box.querySelector('.score')
    expect(score?.classList.contains('score-high')).toBe(true)
    expect(score?.textContent).toBe('85')
  })
})
