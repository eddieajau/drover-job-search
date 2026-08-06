import { describe, expect, it } from 'vitest'

import { parseJobDetail } from './helpers.js'

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
})
