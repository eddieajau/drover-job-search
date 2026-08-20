/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { normaliseWorkplace } from '../common/index.js'
import {
  classifyWorkplaceType,
  excerpt,
  extractDivContent,
  matchesWorkType,
  parseJobDetail,
  workTypeFlag,
} from './parse.js'

describe('extractDivContent', () => {
  it('extracts content from a div with matching class', () => {
    const html = '<div class="target-class">Hello world</div>'
    expect(extractDivContent(html, 'target-class')).toBe('Hello world')
  })

  it('handles nested divs correctly', () => {
    const html = '<div class="outer">' + '<div class="inner">nested</div>' + '<p>more</p>' + '</div>'
    expect(extractDivContent(html, 'outer')).toBe('<div class="inner">nested</div><p>more</p>')
  })

  it('returns null when class is not found', () => {
    const html = '<div class="other">content</div>'
    expect(extractDivContent(html, 'missing-class')).toBeNull()
  })

  it('handles multiple class matches by returning the first', () => {
    const html = '<div class="desc">First</div>' + '<div class="desc">Second</div>'
    expect(extractDivContent(html, 'desc')).toBe('First')
  })

  it('returns null for unclosed div', () => {
    const html = '<div class="open">No closing tag'
    expect(extractDivContent(html, 'open')).toBeNull()
  })
})

describe('parseJobDetail', () => {
  it('preserves structural tags in the raw description HTML', () => {
    const html =
      '<div class="show-more-less-html__markup">' +
      '<p>We do <strong>stuff</strong> at <em>Acme</em>.</p>' +
      '<ul><li>a</li><li>b</li></ul>' +
      'The Team<br>More text' +
      '</div>'

    const detail = parseJobDetail(html, '123456')

    expect(detail.description).toBe(
      '<p>We do <strong>stuff</strong> at <em>Acme</em>.</p><ul><li>a</li><li>b</li></ul>The Team<br>More text'
    )
  })

  it('decodes entities without flattening', () => {
    const html = '<div class="show-more-less-html__markup">C++ &amp; C# &mdash; now &nbsp; hiring</div>'

    const detail = parseJobDetail(html, '123456')

    expect(detail.description).toBe('C++ & C# &mdash; now   hiring')
  })

  it('falls back to description__text when show-more-less markup is absent', () => {
    const html = '<div class="description__text">Fallback <strong>bold</strong></div>'

    const detail = parseJobDetail(html, '123456')

    expect(detail.description).toBe('Fallback <strong>bold</strong>')
  })

  it('returns null when no description div is present', () => {
    const detail = parseJobDetail('<div class="topcard__title">No description here</div>', '123456')

    expect(detail.description).toBeNull()
  })

  it('extracts the workplace type from the criteria row', () => {
    const html =
      '<div class="show-more-less-html__markup"><p>Some job</p></div>' +
      '<h3 class="description__job-criteria-subheader">Workplace type</h3>' +
      '<span class="description__job-criteria-text">On-site</span>'

    const detail = parseJobDetail(html, '123456')

    expect(detail.workplaceType).toBe('onsite')
  })

  it('leaves workplace type null when no criteria row is present', () => {
    const detail = parseJobDetail('<div class="show-more-less-html__markup"><p>Some job</p></div>', '123456')

    expect(detail.workplaceType).toBeNull()
  })

  it('sets closed to true when "No longer accepting applications" is present', () => {
    const html =
      '<div class="topcard__flavor--bullet">No longer accepting applications</div>' +
      '<div class="show-more-less-html__markup"><p>Some job</p></div>'

    const detail = parseJobDetail(html, '123456')

    expect(detail.closed).toBe(true)
  })

  it('sets closed to false when the text is not present', () => {
    const detail = parseJobDetail('<div class="show-more-less-html__markup"><p>Some job</p></div>', '123456')

    expect(detail.closed).toBe(false)
  })
})

describe('workTypeFlag', () => {
  it('maps a single mode to its LinkedIn code', () => {
    expect(workTypeFlag('remote')).toBe('2')
    expect(workTypeFlag('hybrid')).toBe('3')
    expect(workTypeFlag('onsite')).toBe('1')
    expect(workTypeFlag('on-site')).toBe('1')
  })

  it('maps a comma-separated list, normalising case and whitespace', () => {
    expect(workTypeFlag('remote,hybrid')).toBe('2,3')
    expect(workTypeFlag('On-site, REMOTE')).toBe('1,2')
  })

  it('returns null for an empty or unknown value', () => {
    expect(workTypeFlag(undefined)).toBeNull()
    expect(workTypeFlag('')).toBeNull()
    expect(workTypeFlag('teleport')).toBeNull()
  })
})

describe('normaliseWorkplace', () => {
  it('canonicalises LinkedIn workplace labels', () => {
    expect(normaliseWorkplace('Remote')).toBe('remote')
    expect(normaliseWorkplace('Hybrid')).toBe('hybrid')
    expect(normaliseWorkplace('On-site')).toBe('onsite')
    expect(normaliseWorkplace('Onsite')).toBe('onsite')
  })

  it('returns null for empty or unrecognised labels', () => {
    expect(normaliseWorkplace(null)).toBeNull()
    expect(normaliseWorkplace('  ')).toBeNull()
    expect(normaliseWorkplace('Travelling')).toBeNull()
  })
})

describe('classifyWorkplaceType', () => {
  it('prefers the criteria row over description heuristics', () => {
    expect(classifyWorkplaceType({ workplaceType: 'remote', description: 'Hybrid working two days a week' })).toBe(
      'remote'
    )
  })

  it('falls back to description heuristics when no criteria row exists', () => {
    expect(classifyWorkplaceType({ workplaceType: null, description: 'Hybrid working (2 days/week in office)' })).toBe(
      'hybrid'
    )
    expect(
      classifyWorkplaceType({ workplaceType: null, description: 'You will work fully remote across Australia' })
    ).toBe('remote')
    expect(
      classifyWorkplaceType({ workplaceType: null, description: 'This role is based in our CBD office, on-site' })
    ).toBe('onsite')
  })

  it('ignores weak description mentions that are not work-arrangement statements', () => {
    expect(
      classifyWorkplaceType({ workplaceType: null, description: 'Travel discounts, perks and #hybrid' })
    ).toBeNull()
    expect(
      classifyWorkplaceType({ workplaceType: null, description: 'Azure hybrid cloud and on-premise platforms' })
    ).toBeNull()
    expect(
      classifyWorkplaceType({ workplaceType: null, description: 'Work from Home Equipment and a Novated Lease' })
    ).toBeNull()
    expect(
      classifyWorkplaceType({
        workplaceType: null,
        description: "'Engine' is the remote gaming server behind the platform",
      })
    ).toBeNull()
  })

  it('matches explicit arrangement phrases anywhere in the description', () => {
    expect(
      classifyWorkplaceType({ workplaceType: null, description: 'Permanent, hybrid position in our Brisbane office' })
    ).toBe('hybrid')
    expect(
      classifyWorkplaceType({ workplaceType: null, description: 'Fully REMOTE Mid-level Back-End Developer' })
    ).toBe('remote')
    expect(
      classifyWorkplaceType({ workplaceType: null, description: 'We are remote-first with quarterly meetups' })
    ).toBe('remote')
    expect(classifyWorkplaceType({ workplaceType: null, description: 'Work remotely with flexible hours' })).toBe(
      'remote'
    )
    expect(classifyWorkplaceType({ workplaceType: null, description: 'A 100% remote role across Australia' })).toBe(
      'remote'
    )
    expect(classifyWorkplaceType({ workplaceType: null, description: 'WFH is fully supported' })).toBe('remote')
    expect(classifyWorkplaceType({ workplaceType: null, description: 'This office-based role is in the CBD' })).toBe(
      'onsite'
    )
  })

  it('returns null when nothing can be determined', () => {
    expect(classifyWorkplaceType({ workplaceType: null, description: 'A fine place to work' })).toBeNull()
    expect(classifyWorkplaceType({ workplaceType: null, description: null })).toBeNull()
  })
})

describe('excerpt', () => {
  it('returns null for null input', () => {
    expect(excerpt(null)).toBeNull()
  })

  it('returns the string unchanged when shorter than n', () => {
    expect(excerpt('short', 240)).toBe('short')
  })

  it('slices a prefix of length n when longer', () => {
    const long = 'x'.repeat(300)
    expect(excerpt(long, 240)).toBe('x'.repeat(240))
  })

  it('defaults n to 240', () => {
    expect(excerpt('y'.repeat(500))).toHaveLength(240)
  })
})

describe('matchesWorkType', () => {
  it('accepts any workplace when no filter is wanted', () => {
    expect(matchesWorkType(undefined, 'onsite')).toBe(true)
    expect(matchesWorkType(undefined, null)).toBe(true)
  })

  it('matches a comma-list of allowed workplace types', () => {
    expect(matchesWorkType('remote,hybrid', 'hybrid')).toBe(true)
    expect(matchesWorkType('remote', 'remote')).toBe(true)
    expect(matchesWorkType('remote', 'hybrid')).toBe(false)
  })

  it('rejects unclassified jobs when a filter is wanted', () => {
    expect(matchesWorkType('remote', null)).toBe(false)
  })
})

describe('helper dedup', () => {
  it('parse.ts sources shared helpers from ../common only', () => {
    const src = readFileSync(resolve(import.meta.dirname, 'parse.ts'), 'utf-8')

    expect(src).toContain("from '../common/index.js'")
    // No LinkedIn-local redefinitions of the shared helpers.
    expect(src).not.toMatch(/function\s+normaliseWorkplace/)
    expect(src).not.toMatch(/function\s+htmlFetch/)
    expect(src).not.toContain('const UA')
    expect(src).not.toContain('silentLogger')
  })
})
