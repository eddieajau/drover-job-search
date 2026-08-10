/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it } from 'vitest'

import { chunkResume } from './chunk-resume.js'

// Minimal, anonymised resume fixture. No real personal data — venues, dates and
// project descriptions are fabricated; it only needs the shapes the chunker parses.
const RESUME_V1 = `## Summary

Head chef with many years across catering and hospitality projects.

Skilled in menu engineering, kitchen operations, and food safety systems.

## Signature Dishes & Kitchen Systems Built

Anonymised projects demonstrating kitchen process and automation work.

### **Colour-Coded Recipe Pipeline + Inventory Automation**

_Blue Kettle, Green Pepper, personal projects_

- **Built** a \`/plan → /prep\` workflow that turns menu concepts into deliverable dishes.
- **Scope:** Constrained supplier access and head chef approval boundaries.

### **Local-First Recipe Archive**

_Personal project (Jan 2024)_

- **Built** a local-first recipe system with persistent photo storage.

### **Kitchen Efficiency Intelligence Platform**

_Personal project (Mar 2026)_

- **Built** a durable prep pipeline with deterministic stages and local timing data.

## Skills & Competencies Matrix

(1 knowledge of, 5 Expert)

| Technology             | Ranking | Years experience | Versions             |
| ----------------------- | ------- | ---------------- | --------------------- |
| Menu Engineering         | 5       | 9                 | Seasonal, Tasting     |
| Knife Skills             | 5       | 20                | Classical, Japanese   |
| Pastry                   | 3       | 4                 | Viennoiserie           |
| Wine Pairing             | 3       | 3                 | Old World, New World  |
| Kitchen Safety Systems   | 4       | 15                | HACCP                  |
| Team Leadership          | 4       | 13                |                        |

## Work History

### Head Chef

September 2022 - November 2024

- Led a team of 12 across three services.
- Redesigned the seasonal menu, increasing average ticket price by 18%.

### Sous Chef

A short note about a kitchen renovation project.

March 2021 - August 2022 - Contract, full time

### Kitchen Manager

October 2020 - February 2021

### Chef de Partie at Amber Table

June 2018 - September 2020

- Ran the grill station during peak service.
- Trained two apprentice chefs.

### Line Cook at Crimson Fork**

May 2016 - May 2018

### Pastry Chef at Copper Pot

Apr 2011 - Apr 2016 (5 years) - Contract

### Executive Chef, at Indigo Spoon

Jun 2008 - Mar 2011

### Catering Consultant at Saffron Kitchen

Oct 2002 - May 2008

## Education

- **Bachelor of Science** from Outstanding University, 1998.

## Hobbies

Hyrocks.
`

describe('chunkResume', () => {
  it('splits the resume fixture into six typed sections', () => {
    const chunked = chunkResume(RESUME_V1)

    expect(chunked.sections).toHaveLength(6)
    expect(chunked.sections.map(s => s.heading)).toEqual([
      'Summary',
      'Signature Dishes & Kitchen Systems Built',
      'Skills & Competencies Matrix',
      'Work History',
      'Education',
      'Hobbies',
    ])
    expect(chunked.sections.map(s => s.type)).toEqual(['summary', 'projects', 'other', 'other', 'education', 'hobbies'])
    expect(chunked.sections[0].body).toContain('Skilled in menu engineering')
    expect(chunked.sections[0].body).not.toContain('## ')
  })

  it('classifies common heading variants by keyword', () => {
    const chunked = chunkResume(
      '## Professional Summary\nbody\n\n## Selected Projects\nbody\n\n## Academic Background\nbody\n\n## Interests\nbody'
    )

    expect(chunked.sections.map(s => s.type)).toEqual(['summary', 'projects', 'education', 'hobbies'])
  })

  it('parses the skills matrix with typed cells', () => {
    const matrix = chunkResume(RESUME_V1).skillsMatrix

    expect(matrix).toHaveLength(6)
    for (const row of matrix) {
      expect(typeof row.ranking).toBe('number')
      expect(typeof row.years).toBe('number')
    }
    expect(matrix).toContainEqual({
      technology: 'Menu Engineering',
      ranking: 5,
      years: 9,
      versions: 'Seasonal, Tasting',
    })
    expect(matrix).toContainEqual({
      technology: 'Kitchen Safety Systems',
      ranking: 4,
      years: 15,
      versions: 'HACCP',
    })
    expect(matrix).toContainEqual({ technology: 'Team Leadership', ranking: 4, years: 13, versions: null })
  })

  it('parses all 8 Work History roles with dates and companies', () => {
    const roles = chunkResume(RESUME_V1).roles

    expect(roles).toHaveLength(8)
    expect(roles).toContainEqual({
      title: 'Head Chef',
      company: null,
      startedAt: '2022-09',
      endedAt: '2024-11',
    })
    expect(roles).toContainEqual({
      title: 'Sous Chef',
      company: null,
      startedAt: '2021-03',
      endedAt: '2022-08',
    })
    expect(roles).toContainEqual({
      title: 'Line Cook',
      company: 'Crimson Fork**',
      startedAt: '2016-05',
      endedAt: '2018-05',
    })
    expect(roles).toContainEqual({
      title: 'Executive Chef,',
      company: 'Indigo Spoon',
      startedAt: '2008-06',
      endedAt: '2011-03',
    })
    expect(roles).toContainEqual({
      title: 'Pastry Chef',
      company: 'Copper Pot',
      startedAt: '2011-04',
      endedAt: '2016-04',
    })
  })

  it('keeps the three project chunks under the projects section', () => {
    const projects = chunkResume(RESUME_V1).sections.find(s => s.type === 'projects')

    expect(projects).toBeDefined()
    expect(projects!.body).toContain('### **Colour-Coded Recipe Pipeline + Inventory Automation**')
    expect(projects!.body).toContain('### **Local-First Recipe Archive**')
    expect(projects!.body).toContain('### **Kitchen Efficiency Intelligence Platform**')
    expect(projects!.body).toContain('- **Built** a `/plan → /prep` workflow')
    expect(projects!.body).toContain('_Personal project (Mar 2026)_')
  })

  it('returns empty arrays for empty or non-markdown input', () => {
    expect(chunkResume('')).toEqual({ sections: [], skillsMatrix: [], roles: [] })
    expect(chunkResume('plain text with no headings\n\njust some prose')).toEqual({
      sections: [],
      skillsMatrix: [],
      roles: [],
    })
  })

  it('returns empty skills and roles when their sections are absent', () => {
    const chunked = chunkResume('## Summary\nHello\n\n## Education\nBSc')

    expect(chunked.sections).toHaveLength(2)
    expect(chunked.skillsMatrix).toEqual([])
    expect(chunked.roles).toEqual([])
  })
})
