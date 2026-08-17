export interface SeekJobDetail {
  id: string
  title: string
  company: string
  url: string
  location: string | null
  workplaceType: 'onsite' | 'hybrid' | 'remote' | null
  employmentType: string | null
  descriptionHtml: string | null
  postedAt: string | null
  classification: string | null
  industry: string | null
}

type LogFn = (obj: unknown, msg?: string) => void

export interface SeekLogger {
  trace: LogFn
  debug: LogFn
  info: LogFn
  warn: LogFn
}

export const silentLogger: SeekLogger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string, logger: SeekLogger = silentLogger): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
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

/** Map Seek workplace arrangement labels to canonical types. */
export function normaliseWorkplace(raw: string | null): 'onsite' | 'hybrid' | 'remote' | null {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v) return null
  if (v.startsWith('remote')) return 'remote'
  if (v.startsWith('hybrid')) return 'hybrid'
  if (v.startsWith('on-site') || v.startsWith('onsite')) return 'onsite'
  return null
}

/** Extract the balanced object literal starting at `startIdx` (must point at `{`). */
function extractBalancedObject(html: string, startIdx: number): string | null {
  if (html[startIdx] !== '{') return null

  let i = startIdx
  let depth = 0
  let inString: string | null = null

  while (i < html.length) {
    const ch = html[i]

    if (inString) {
      if (ch === '\\' && i + 1 < html.length) {
        i += 2
        continue
      }
      if (ch === inString) {
        inString = null
      }
    } else {
      if (ch === "'" || ch === '"') {
        inString = ch
      } else if (ch === '{') {
        depth++
      } else if (ch === '}') {
        depth--
        if (depth === 0) return html.slice(startIdx, i + 1)
      }
    }
    i++
  }

  return null
}

/**
 * Convert a JavaScript object literal string to valid JSON.
 * Handles unquoted keys, mixed single/double-quoted strings,
 * JS escape sequences, and trailing commas.
 */
function jsObjectToJson(js: string): string {
  let result = ''
  let i = 0
  const len = js.length

  while (i < len) {
    const ch = js[i]

    if (ch === "'" || ch === '"') {
      const delim = ch
      result += '"'
      i++
      while (i < len) {
        const c = js[i]
        if (c === '\\' && i + 1 < len) {
          const next = js[i + 1]
          if (next === delim) {
            if (delim === '"') {
              result += '\\"'
            } else {
              result += next
            }
            i += 2
          } else {
            result += c + next
            i += 2
          }
        } else if (c === delim) {
          result += '"'
          i++
          break
        } else if (delim === "'" && c === '"') {
          result += '\\"'
          i++
        } else {
          result += c
          i++
        }
      }
      continue
    }

    if (/[a-zA-Z_$]/.test(ch)) {
      let word = ''
      while (i < len && /[a-zA-Z0-9_$]/.test(js[i])) {
        word += js[i]
        i++
      }
      let j = i
      while (j < len && /\s/.test(js[j])) j++
      if (j < len && js[j] === ':') {
        result += '"' + word + '"'
      } else {
        result += word
      }
      continue
    }

    result += ch
    i++
  }

  return result.replace(/,(\s*[}\]])/g, '$1')
}

/** Extract the SEEK_REDUX_DATA object from a Seek job page HTML. */
function extractSeekData(html: string): Record<string, unknown> | null {
  const marker = 'window.SEEK_REDUX_DATA = '
  const idx = html.indexOf(marker)
  if (idx === -1) return null

  const braceStart = idx + marker.length
  const objText = extractBalancedObject(html, braceStart)
  if (!objText) return null

  const json = jsObjectToJson(objText)
  return JSON.parse(json) as Record<string, unknown>
}

/** Safely navigate a nested object by property path. */
function nav(obj: unknown, ...keys: Array<string | number>): unknown {
  let cur: unknown = obj
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

/** Parse a Seek job page HTML string into a structured SeekJobDetail. */
export function parseSeekJob(html: string, jobUrl: string): SeekJobDetail | null {
  if (!html) return null

  const data = extractSeekData(html)
  if (!data) return null

  const result = nav(data, 'jobdetails', 'result')
  if (!result || typeof result !== 'object') return null

  const r = result as Record<string, unknown>

  const job = r.job as Record<string, unknown> | undefined
  if (!job) return null

  const id = job.id as string | undefined
  const title = job.title as string | undefined
  if (!id || !title) return null

  const advertiser = job.advertiser as Record<string, unknown> | undefined
  const companyProfile = r.companyProfile as Record<string, unknown> | undefined
  const company = (advertiser?.name ?? companyProfile?.name) as string | undefined

  const loc = job.location as Record<string, unknown> | undefined
  const location = (loc?.label as string) ?? null

  const workArrangements = r.workArrangements as Record<string, unknown> | undefined
  const workplaceType = normaliseWorkplace((workArrangements?.label as string) ?? null)

  const workTypes = job.workTypes as Record<string, unknown> | undefined
  const employmentType = normaliseEmploymentType((workTypes?.label as string) ?? null)

  const descriptionHtml = (job.content as string) ?? null

  const listedAt = job.listedAt as Record<string, unknown> | undefined
  const postedAt = (listedAt?.dateTimeUtc as string) ?? null

  const classifications = job.classifications as Array<Record<string, unknown>> | undefined
  const classification = (classifications?.[0]?.label as string) ?? null

  const companyProfileObj = r.companyProfile as Record<string, unknown> | undefined
  const overview = companyProfileObj?.overview as Record<string, unknown> | undefined
  const industry = (overview?.industry as string) ?? null

  return {
    id,
    title,
    company: company ?? '(unknown)',
    url: jobUrl,
    location,
    workplaceType,
    employmentType,
    descriptionHtml,
    postedAt,
    classification,
    industry,
  }
}

/** Map Seek work-types labels to kebab-case. */
function normaliseEmploymentType(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  if (v === 'full time') return 'full-time'
  if (v === 'part time') return 'part-time'
  return v
}
