// Adapted from linkedin-search-cli (MIT License).
// Original: https://github.com/MadsLorentzen/ai-job-search/tree/main/.agents/skills/linkedin-search/cli
//
// Data source: LinkedIn public "jobs-guest" endpoints. No authentication required.
// Search returns an HTML list of job cards; detail returns a single job's HTML.
// We parse both with regex (the markup is shallow and stable; a full DOM parser
// is unnecessary and node-html-parser has known nesting bugs on LinkedIn cards).

export const SEARCH_URL = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
export const DETAIL_URL = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type LogFn = (obj: unknown, msg?: string) => void

/** Minimal pino-compatible logger surface used across the provider. */
export interface SearchLogger {
  debug: LogFn
  info: LogFn
  warn: LogFn
}

export const silentLogger: SearchLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
}

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string, logger: SearchLogger = silentLogger): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise(r => setTimeout(r, delay + jitter))
      logger.warn(
        { status: response.status, attempt: attempt + 1, backoffMs: delay + jitter, url },
        'request throttled'
      )
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ''
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error('Request failed after max retries')
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  companyUrl: string | null
  location: string | null
  date: string | null
  url: string
  /** Classified workplace type, set on kept cards by the search verify loop. Undefined when no verify ran. */
  workplace?: WorkplaceType | null
}

export interface JobDetail extends JobCard {
  description: string | null
  seniority: string | null
  employmentType: string | null
  jobFunction: string | null
  industries: string | null
  workplaceType: string | null
  applyUrl: string | null
  closed: boolean
}

/**
 * Extract the inner HTML of a <div> identified by a CSS class name, correctly
 * handling nested <div> elements by tracking tag depth.
 */
export function extractDivContent(html: string, className: string): string | null {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const openRe = new RegExp(`<div[^>]*class="[^"]*${escaped}[^"]*"[^>]*>`, 'i')
  const open = openRe.exec(html)
  if (!open) return null

  let i = open.index + open[0].length
  let depth = 1

  while (depth > 0 && i < html.length) {
    const nextOpen = html.indexOf('<div', i)
    const nextClose = html.indexOf('</div>', i)

    if (nextClose === -1) return null

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      i = nextOpen + 4
    } else {
      depth--
      i = nextClose + 6
    }
  }

  return html.slice(open.index + open[0].length, i - 6)
}

/**
 * Convert a Unicode code point to a string. Uses `fromCodePoint` (not
 * `fromCharCode`) so supplementary-plane code points (e.g. emoji, U+1F600)
 * decode correctly, and drops out-of-range values instead of throwing.
 */
function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ''
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, ' ')
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/**
 * Parse the search response: a flat list of <li> job cards. We split on the
 * job-posting URN and parse each chunk independently so one malformed card
 * cannot break the rest.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split(/data-entity-urn="urn:li:jobPosting:/).slice(1)

  for (const chunk of chunks) {
    const idMatch = chunk.match(/^(\d+)/)
    if (!idMatch) continue
    const id = idMatch[1]

    const linkMatch = chunk.match(/class="base-card__full-link[^"]*"[^>]*href="([^"]+)"/i)
    const url = linkMatch ? decodeHtmlEntities(linkMatch[1]).split('?')[0] : ''

    let title: string | null = null
    const h3 = chunk.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/i)
    if (h3) title = clean(h3[1])
    if (!title) {
      const sr = chunk.match(/class="sr-only"[^>]*>([\s\S]*?)<\/span>/i)
      if (sr) title = clean(sr[1])
    }
    if (!title) continue

    let company: string | null = null
    let companyUrl: string | null = null
    const sub = chunk.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/i)
    if (sub) {
      const a = sub[1].match(/href="([^"]+)"/i)
      if (a) companyUrl = decodeHtmlEntities(a[1]).split('?')[0]
      company = clean(sub[1]) || null
    }

    const loc = chunk.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/i)
    const location = loc ? clean(loc[1]) || null : null
    const dt = chunk.match(/class="job-search-card__listdate[^"]*"[^>]*datetime="([^"]+)"/i)
    const date = dt ? dt[1] : null

    results.push({
      id,
      title,
      company,
      companyUrl,
      location,
      date,
      url: url || `https://www.linkedin.com/jobs/view/${id}`,
    })
  }

  return results
}

/** Parse the single-job detail page. */
export function parseJobDetail(html: string, id: string): JobDetail {
  const title = html.match(/class="(?:top-card-layout__title|topcard__title)[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1]
  const orgMatch = html.match(/class="topcard__org-name-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
  const company = orgMatch ? clean(orgMatch[2]) || null : null
  const companyUrl = orgMatch ? decodeHtmlEntities(orgMatch[1]).split('?')[0] : null

  const locMatch = html.match(/class="topcard__flavor topcard__flavor--bullet"[^>]*>([\s\S]*?)<\/span>/i)
  const location = locMatch ? clean(locMatch[1]) || null : null

  let description: string | null = null
  const descHtml =
    extractDivContent(html, 'show-more-less-html__markup') ?? extractDivContent(html, 'description__text')
  if (descHtml) {
    description = decodeHtmlEntities(descHtml).trim() || null
  }

  const criteria: Record<string, string> = {}
  const itemRe =
    /class="description__job-criteria-subheader"[^>]*>([\s\S]*?)<\/h3>[\s\S]*?class="description__job-criteria-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi
  let cm: RegExpExecArray | null
  while ((cm = itemRe.exec(html)) !== null) {
    criteria[clean(cm[1]).toLowerCase()] = clean(cm[2])
  }

  const applyMatch = html.match(/class="topcard__link[^"]*"[^>]*href="([^"]+)"/i)
  const applyUrl = applyMatch ? decodeHtmlEntities(applyMatch[1]).split('?')[0] : null

  // Detect closed jobs: LinkedIn shows "No longer accepting applications" on expired listings.
  const closed = /no\s+longer\s+accepting\s+applications/i.test(html)

  return {
    id,
    title: title ? clean(title) : '(untitled)',
    company,
    companyUrl,
    location,
    date: null,
    url: `https://www.linkedin.com/jobs/view/${id}`,
    description,
    seniority: criteria['seniority level'] ?? null,
    employmentType: criteria['employment type'] ?? null,
    jobFunction: criteria['job function'] ?? null,
    industries: criteria['industries'] ?? null,
    workplaceType: normaliseWorkplace(criteria['workplace type'] ?? null),
    applyUrl,
    closed,
  }
}

/** Convert a job-age in days to LinkedIn's f_TPR seconds value. */
export function jobageToTPR(days: number): string | null {
  if (!days || days <= 0 || days >= 9999) return null
  return `r${days * 86400}`
}

/**
 * Workplace-type flag(s) for LinkedIn's f_WT parameter.
 * Accepts a comma-separated list of: remote, hybrid, onsite (or on-site).
 * Returns a comma-joined string of the corresponding codes, or null if none match.
 */
export function workTypeFlag(mode: string | undefined): string | null {
  if (!mode) return null
  const map: Record<string, string> = {
    remote: '2',
    hybrid: '3',
    onsite: '1',
    'on-site': '1',
  }
  const codes = mode
    .split(',')
    .map(m => map[m.trim().toLowerCase()])
    .filter(Boolean)
  return codes.length ? codes.join(',') : null
}

/** Normalise a workplace label (e.g. "On-site", "Remote") to a canonical token. */
export function normaliseWorkplace(raw: string | null): WorkplaceType | null {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v) return null
  if (v.startsWith('remote')) return 'remote'
  if (v.startsWith('hybrid')) return 'hybrid'
  if (v.startsWith('on-site') || v.startsWith('onsite')) return 'onsite'
  return null
}

export type WorkplaceType = 'onsite' | 'hybrid' | 'remote'

/** Return a bounded leading slice of `text`, or null when text is null. */
export function excerpt(text: string | null, n = 240): string | null {
  if (text === null) return null
  return text.length > n ? text.slice(0, n) : text
}

/**
 * Best-effort workplace classification for a job detail.
 * The detail page's "Workplace type" criteria row is authoritative; when it is
 * absent we fall back to scanning the description (LinkedIn does not tag every
 * job, e.g. the iterate Technical Lead that leaks through the remote filter).
 */
export function classifyWorkplaceType(detail: {
  workplaceType: string | null
  description: string | null
}): WorkplaceType | null {
  if (detail.workplaceType) return detail.workplaceType as WorkplaceType
  const text = (detail.description ?? '').toLowerCase()
  if (text.includes('hybrid')) return 'hybrid'
  if (text.includes('on-site') || text.includes('onsite') || text.includes('in-office') || text.includes('in office')) {
    return 'onsite'
  }
  if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) return 'remote'
  return null
}

/** True when a classified workplace type falls within the wanted comma-list. */
export function matchesWorkType(wanted: string | undefined, actual: string | null): boolean {
  if (!wanted) return true
  if (!actual) return false
  const allowed = wanted
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(actual)
}

/**
 * Job-type flag(s) for LinkedIn's f_JT parameter.
 * Accepts a comma-separated list of: fulltime, parttime, contract,
 * temporary, volunteer, internship, other.
 * Returns a comma-joined string of the corresponding codes, or null if none match.
 */
export function jobTypeFlag(types: string | undefined): string | null {
  if (!types) return null
  const map: Record<string, string> = {
    fulltime: 'F',
    'full-time': 'F',
    parttime: 'P',
    'part-time': 'P',
    contract: 'C',
    temporary: 'T',
    volunteer: 'V',
    internship: 'I',
    other: 'O',
  }
  const codes = types
    .split(',')
    .map(t => map[t.trim().toLowerCase()])
    .filter(Boolean)
  return codes.length ? codes.join(',') : null
}
