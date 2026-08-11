/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { describe, expect, it } from 'vitest'

import { chunkResume } from './chunkResume.js'

// Minimal, anonymised resume fixture. No real personal data — venues, dates and
// project descriptions are fabricated; it only needs the shapes the slicer parses.
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
  it('slices the resume fixture into six typed sections', () => {
    const chunked = chunkResume(RESUME_V1)

    expect(chunked.sections).toHaveLength(6)
    expect(chunked.sections.map(s => s.title)).toEqual([
      'Summary',
      'Signature Dishes & Kitchen Systems Built',
      'Skills & Competencies Matrix',
      'Work History',
      'Education',
      'Hobbies',
    ])
    expect(chunked.sections.map(s => s.category)).toEqual([
      'summary',
      'projects',
      'skills',
      'experience',
      'education',
      'hobbies',
    ])
    expect(chunked.sections[0].body).toContain('Skilled in menu engineering')
    expect(chunked.sections[0].body).not.toContain('## ')
  })

  it('categorises common heading variants by keyword', () => {
    const chunked = chunkResume(
      '## Professional Summary\nbody\n\n## Selected Projects\nbody\n\n## Academic Background\nbody\n\n## Interests\nbody'
    )

    expect(chunked.sections.map(s => s.category)).toEqual(['summary', 'projects', 'education', 'hobbies'])
  })

  it('categorises Agentic Systems headings as projects', () => {
    const chunked = chunkResume('## Production AI / Agentic Systems\n\n### Project One\n\nbuilt a thing')

    expect(chunked.sections[0].category).toBe('projects')
    expect(chunked.sections[0].children).toHaveLength(1)
  })

  it('collects ### children under their section, dropping leading prose', () => {
    const chunked = chunkResume(RESUME_V1)
    const projects = chunked.sections.find(s => s.category === 'projects')

    expect(projects).toBeDefined()
    expect(projects!.children.map(c => c.title)).toEqual([
      '**Colour-Coded Recipe Pipeline + Inventory Automation**',
      '**Local-First Recipe Archive**',
      '**Kitchen Efficiency Intelligence Platform**',
    ])
    expect(projects!.children[0].body).toContain('turns menu concepts into deliverable dishes')
    expect(projects!.children[2].body).toContain('_Personal project (Mar 2026)_')
    expect(projects!.body).toContain('Anonymised projects')
    for (const child of projects!.children) {
      expect(child.body).not.toContain('Anonymised projects')
    }
  })

  it('collects work history roles as experience section children', () => {
    const chunked = chunkResume(RESUME_V1)
    const experience = chunked.sections.find(s => s.category === 'experience')

    expect(experience!.children.map(c => c.title)).toEqual([
      'Head Chef',
      'Sous Chef',
      'Kitchen Manager',
      'Chef de Partie at Amber Table',
      'Line Cook at Crimson Fork**',
      'Pastry Chef at Copper Pot',
      'Executive Chef, at Indigo Spoon',
      'Catering Consultant at Saffron Kitchen',
    ])
  })

  it('leaves children empty for sections without ### headings', () => {
    const chunked = chunkResume(RESUME_V1)

    expect(chunked.sections.find(s => s.category === 'summary')!.children).toEqual([])
    expect(chunked.sections.find(s => s.category === 'education')!.children).toEqual([])
    expect(chunked.sections.find(s => s.category === 'hobbies')!.children).toEqual([])
  })

  it('returns an empty result for an empty or whitespace-only resume', () => {
    expect(chunkResume('')).toEqual({ sections: [] })
    expect(chunkResume('  \n\t ')).toEqual({ sections: [] })
  })

  it('wraps a headingless resume in a single other section with one child', () => {
    const chunked = chunkResume('plain text with no headings\n\njust some prose')

    expect(chunked.sections).toHaveLength(1)
    expect(chunked.sections[0].category).toBe('other')
    expect(chunked.sections[0].children).toHaveLength(1)
    expect(chunked.sections[0].body).toContain('plain text with no headings')
    expect(chunked.sections[0].children[0].body).toContain('just some prose')
  })

  it('keeps Professional Summary as summary and unknown headings as other', () => {
    const chunked = chunkResume(
      '## Professional Summary\nbody\n\n## Work Experience\nbody\n\n## Technical Skills\nbody\n\n## Random Stuff\nbody'
    )

    expect(chunked.sections.map(s => s.category)).toEqual(['summary', 'experience', 'skills', 'other'])
  })
})
