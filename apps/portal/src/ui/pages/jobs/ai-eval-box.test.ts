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

  it('maps score to three colour bands at the 60 and 30 boundaries', () => {
    const cases: Array<[string, string]> = [
      ['60', 'score-high'],
      ['59', 'score-mid'],
      ['30', 'score-mid'],
      ['29', 'score-low'],
    ]
    for (const [score, band] of cases) {
      const box = createBox({ verdict: 'Verdict', score })
      expect(box.querySelector('.score')?.classList.contains(band)).toBe(true)
    }
  })

  it('renders a Recent chip beside the verdict when urgent', () => {
    const box = createBox({ verdict: 'Strong fit', score: '80', urgent: '' })

    const chip = box.querySelector('.chip-recent')
    expect(chip?.textContent).toBe('Recent')
  })

  it('omits the Recent chip when not urgent', () => {
    const box = createBox({ verdict: 'Strong fit', score: '80' })
    expect(box.querySelector('.chip-recent')).toBeNull()
  })

  it('renders strengths and gaps lists via setWhy', () => {
    const box = createBox({ verdict: 'High match', score: '61' })
    box.setWhy({ strengths: ['Deep TypeScript match'], gaps: ['No Kafka experience'] })

    const labels = box.querySelectorAll('.eval-why-label')
    expect(labels).toHaveLength(2)
    expect(labels[0]?.textContent).toBe('Strengths')
    expect(labels[1]?.textContent).toBe('Gaps')

    const lists = box.querySelectorAll('.eval-why-block ul')
    expect(lists[0]?.textContent).toContain('Deep TypeScript match')
    expect(lists[1]?.textContent).toContain('No Kafka experience')
  })

  it('escapes HTML in setWhy items', () => {
    const box = createBox({ verdict: 'High match', score: '61' })
    box.setWhy({ strengths: ['<script>alert("x")</script>'], gaps: ['<b>bold</b>'] })

    const list = box.querySelector('.eval-why-block ul')
    expect(list?.innerHTML).not.toContain('<script>')
    expect(list?.innerHTML).toContain('&lt;script&gt;')
    expect(list?.textContent).toContain('<script>alert("x")</script>')
  })

  it('clears the lists when setWhy(null) is called', () => {
    const box = createBox({ verdict: 'High match', score: '61' })
    box.setWhy({ strengths: ['Deep TypeScript match'], gaps: ['No Kafka experience'] })
    expect(box.querySelector('.eval-why-lists')).not.toBeNull()

    box.setWhy(null)
    expect(box.querySelector('.eval-why-lists')).toBeNull()
    expect(box.querySelector('.eval-verdict')?.textContent).toBe('High match')
  })
})
