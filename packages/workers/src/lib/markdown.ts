/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  emDelimiter: '*',
})

turndown.addRule('hidden', {
  filter: node => {
    if (node.nodeType !== 1) return false
    const style = node.getAttribute('style')
    return (
      node.hasAttribute('hidden') ||
      node.hasAttribute('aria-hidden') ||
      (style !== null && /(?:display\s*:\s*none|visibility\s*:\s*hidden|(?:width|height)\s*:\s*0)/i.test(style))
    )
  },
  replacement: () => '',
})

/**
 * Convert untrusted job-description HTML to CommonMark.
 *
 * Script, style, and comments are stripped up front as defense-in-depth;
 * turndown passes their raw text through otherwise. Elements flagged hidden
 * (attribute or zero-size style) are dropped so they never leak into the
 * stored markdown. Plain text passes through unchanged, which keeps legacy
 * flattened descriptions safe until they are re-crawled.
 */
export function toMarkdown(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
  return turndown.turndown(cleaned).trim()
}
