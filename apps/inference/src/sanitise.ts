/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&#x27;': "'",
  '&#x2F;': '/',
  '&#47;': '/',
}

const ENTITY_RE = /&(?:amp|lt|gt|quot|apos|nbsp|#39|#x27|#x2F|#47);/gi

const UNICODE_INVISIBLE = new RegExp(
  '[\\u{200B}\\u{200C}\\u{FEFF}\\u{00AD}\\u{2028}\\u{2029}\\u{200E}\\u{200F}\\u{202A}-\\u{202E}\\u{2066}-\\u{2069}]',
  'gu'
)

const WHITESPACE_RE = /\s+/g

function stripAsciiControl(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c <= 0x08 || c === 0x0b || c === 0x0c || (c >= 0x0e && c <= 0x1f) || c === 0x7f) continue
    out += s[i]
  }
  return out
}

export function sanitise(input: string, maxLen = 4000): string {
  let out = input.replace(ENTITY_RE, match => {
    const lower = match.toLowerCase()
    return HTML_ENTITIES[lower] ?? match
  })

  out = out.replace(UNICODE_INVISIBLE, '')
  out = out.replaceAll('\u200D', '')
  out = stripAsciiControl(out)
  out = out.replace(WHITESPACE_RE, ' ').trim()

  if (out.length > maxLen) {
    out = out.slice(0, maxLen)
  }

  return out
}
