/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it } from 'vitest'

import { sectionTypeFor, splitH3Children, splitSections, toYearMonth } from './resume-sections.js'

describe('toYearMonth', () => {
  it('normalises a month name and year to YYYY-MM', () => {
    expect(toYearMonth('Oct', '2025')).toBe('2025-10')
    expect(toYearMonth('Sep', '2024')).toBe('2024-09')
  })

  it('is case-insensitive and tolerates full month names', () => {
    expect(toYearMonth('oct', '2025')).toBe('2025-10')
    expect(toYearMonth('January', '1991')).toBe('1991-01')
    expect(toYearMonth('December', '2016')).toBe('2016-12')
  })

  it('returns null for an unknown month name', () => {
    expect(toYearMonth('Somem', '2025')).toBeNull()
    expect(toYearMonth('', '2025')).toBeNull()
  })
})

describe('sectionTypeFor', () => {
  it('categorises known heading shapes by keyword', () => {
    expect(sectionTypeFor('Summary')).toBe('summary')
    expect(sectionTypeFor('Professional Summary')).toBe('summary')
    expect(sectionTypeFor('Work History')).toBe('experience')
    expect(sectionTypeFor('Professional Experience')).toBe('experience')
    expect(sectionTypeFor('Employment History')).toBe('experience')
    expect(sectionTypeFor('Technical')).toBe('skills')
    expect(sectionTypeFor('Skills & Competencies Matrix')).toBe('skills')
    expect(sectionTypeFor('Production AI / Agentic Systems')).toBe('projects')
    expect(sectionTypeFor('Selected Projects')).toBe('projects')
    expect(sectionTypeFor('Education')).toBe('education')
    expect(sectionTypeFor('Hobbies')).toBe('hobbies')
  })

  it('leaves unrecognised headings as other', () => {
    expect(sectionTypeFor('Random Stuff')).toBe('other')
    expect(sectionTypeFor('')).toBe('other')
  })
})

describe('splitSections', () => {
  it('splits on ## headings into title and body pairs', () => {
    const sections = splitSections('## Summary\n\nHello\n\n## Education\n\nBSc\n\n## Hobbies\n\nCycling')

    expect(sections).toEqual([
      { title: 'Summary', body: 'Hello' },
      { title: 'Education', body: 'BSc' },
      { title: 'Hobbies', body: 'Cycling' },
    ])
  })

  it('does not treat level-1 or level-3 headings as sections', () => {
    const sections = splitSections('# Name\n\n## Work History\n\n### Chef\n\ncooked')

    expect(sections).toEqual([{ title: 'Work History', body: '### Chef\n\ncooked' }])
  })

  it('returns an empty array when there are no level-2 headings', () => {
    expect(splitSections('plain text with no headings')).toEqual([])
    expect(splitSections('')).toEqual([])
  })
})

describe('splitH3Children', () => {
  it('collects each ### chunk with its title and body', () => {
    const children = splitH3Children('### Project One\n\nbuilt a thing\n\n### Project Two\n\nbuilt another')

    expect(children).toEqual([
      { title: 'Project One', body: '### Project One\n\nbuilt a thing' },
      { title: 'Project Two', body: '### Project Two\n\nbuilt another' },
    ])
  })

  it('drops leading prose before the first ### chunk', () => {
    const children = splitH3Children('intro prose\n\n### Project One\n\nbuilt a thing')

    expect(children).toEqual([{ title: 'Project One', body: '### Project One\n\nbuilt a thing' }])
  })

  it('returns an empty array when there are no ### headings', () => {
    expect(splitH3Children('just some prose')).toEqual([])
    expect(splitH3Children('')).toEqual([])
  })
})
