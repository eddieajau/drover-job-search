/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { beforeEach, describe, expect, it } from 'vitest'

import './fact-row.js'
import type { FactRow } from './fact-row.js'

function createRow(attrs: Record<string, string> = {}): FactRow {
  const row = document.createElement('fact-row') as FactRow
  for (const [key, value] of Object.entries(attrs)) {
    row.setAttribute(key, value)
  }
  document.body.appendChild(row)
  return row
}

describe('fact-row', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the row with label, category chip, and edit link', () => {
    const row = createRow({
      'fact-id': '3',
      label: 'TypeScript',
      category: 'skill',
      confidence: 'high',
    })

    expect(row.querySelector('.fact-text')?.textContent).toBe('TypeScript')
    expect(row.querySelector<HTMLAnchorElement>('.fact-text')?.getAttribute('href')).toBe('#facts/edit?id=3')
    expect(row.querySelector<HTMLAnchorElement>('.row-edit')?.getAttribute('href')).toBe('#facts/edit?id=3')
    const chips = Array.from(row.querySelectorAll('.fact-meta .chip'), chip => chip.textContent)
    expect(chips).toContain('Skill')
    expect(chips).toContain('High')
  })

  it('shows the evidence type as a chip when set', () => {
    const row = createRow({
      'fact-id': '1',
      label: 'React',
      category: 'skill',
      'evidence-type': 'project',
      confidence: 'medium',
    })

    const chips = Array.from(row.querySelectorAll('.fact-meta .chip'), chip => chip.textContent)
    expect(chips).toContain('project')
  })

  it('shows the period when set', () => {
    const row = createRow({
      'fact-id': '2',
      label: 'Go',
      category: 'skill',
      period: '2y3m',
      confidence: 'low',
    })

    expect(row.querySelector('.fact-date')?.textContent).toBe('2y3m')
  })

  it('shows started-at to ended-at when no period', () => {
    const row = createRow({
      'fact-id': '4',
      label: 'AWS',
      category: 'credential',
      'started-at': '2024-01',
      'ended-at': '2025-06',
      confidence: 'medium',
    })

    expect(row.querySelector('.fact-date')?.textContent).toBe('2024-01 – 2025-06')
  })

  it('shows since started-at when ongoing', () => {
    const row = createRow({
      'fact-id': '5',
      label: 'Docker',
      category: 'skill',
      'started-at': '2023-03',
      confidence: 'high',
    })

    expect(row.querySelector('.fact-date')?.textContent).toBe('since 2023-03')
  })

  it('escapes HTML in label', () => {
    const row = createRow({
      'fact-id': '6',
      label: '<script>alert("xss")</script>',
      category: 'skill',
      confidence: 'high',
    })

    expect(row.querySelector('.fact-text')?.textContent).toBe('<script>alert("xss")</script>')
    expect(row.innerHTML).not.toContain('<script>')
  })
})
