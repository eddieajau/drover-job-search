/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export interface SkillMatrixRow {
  technology: string
  ranking: number | null
  years: number | null
  versions: string | null
}

export interface RoleSkeleton {
  title: string
  company: string | null
  startedAt: string | null
  endedAt: string | null
}

export type SectionType = 'summary' | 'projects' | 'education' | 'hobbies' | 'other'

export interface ResumeSection {
  type: SectionType
  heading: string
  body: string
}

export interface ChunkedResume {
  sections: ResumeSection[]
  skillsMatrix: SkillMatrixRow[]
  roles: RoleSkeleton[]
}

const SECTION_TYPES: Record<string, SectionType> = {
  Summary: 'summary',
  'Production AI / Agentic Systems Built': 'projects',
  Education: 'education',
  Hobbies: 'hobbies',
}

// Known-format headings match exactly; common variants fall back to these keywords.
// Anything else is `other` — structured content with no known format, still eligible
// for finer LLM evaluation in the slicer rather than being dropped.
const SECTION_TYPE_KEYWORDS: ReadonlyArray<{ type: SectionType; keywords: readonly string[] }> = [
  { type: 'summary', keywords: ['summary', 'profile', 'overview', 'objective'] },
  { type: 'projects', keywords: ['project', 'portfolio', 'built', 'open source'] },
  { type: 'education', keywords: ['educat', 'qualif', 'academ', 'universit', 'college', 'degree'] },
  { type: 'hobbies', keywords: ['hobbie', 'interest', 'leisure'] },
]

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const SKILLS_MATRIX_HEADING = 'Skills & Competencies Matrix'
const WORK_HISTORY_HEADING = 'Work History'

const DATE_RANGE_RE = /^([A-Za-z]+) (\d{4}) - ([A-Za-z]+) (\d{4})/
const TABLE_SEPARATOR_RE = /^\s*\|[\s:|-]+\|\s*$/

function sectionTypeFor(heading: string): SectionType {
  const exact = SECTION_TYPES[heading]
  if (exact) {
    return exact
  }
  const lower = heading.toLowerCase()
  for (const { type, keywords } of SECTION_TYPE_KEYWORDS) {
    if (keywords.some(keyword => lower.includes(keyword))) {
      return type
    }
  }
  return 'other'
}

function splitSections(resume: string): ResumeSection[] {
  const lines = resume.split(/\r?\n/)
  const headingLines: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      headingLines.push(i)
    }
  }

  if (headingLines.length === 0) {
    return []
  }

  const sections: ResumeSection[] = []
  for (let i = 0; i < headingLines.length; i++) {
    const start = headingLines[i]
    const end = i + 1 < headingLines.length ? headingLines[i + 1] : lines.length
    const heading = lines[start].slice(3).trim()
    sections.push({
      type: sectionTypeFor(heading),
      heading,
      body: lines
        .slice(start + 1, end)
        .join('\n')
        .trim(),
    })
  }
  return sections
}

function splitTableRow(line: string): string[] {
  return line
    .split('|')
    .map(cell => cell.trim())
    .slice(1, -1)
}

function parseNumber(value: string): number | null {
  if (value === '') {
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parseSkillsMatrix(sections: ResumeSection[]): SkillMatrixRow[] {
  const section = sections.find(s => s.heading === SKILLS_MATRIX_HEADING)
  if (!section) {
    return []
  }

  const lines = section.body.split(/\r?\n/)
  const separator = lines.findIndex(line => TABLE_SEPARATOR_RE.test(line))
  if (separator === -1) {
    return []
  }

  const rows: SkillMatrixRow[] = []
  for (let i = separator + 1; i < lines.length; i++) {
    const cells = splitTableRow(lines[i])
    if (cells.length < 4) {
      break
    }
    rows.push({
      technology: cells[0],
      ranking: parseNumber(cells[1]),
      years: parseNumber(cells[2]),
      versions: cells[3] === '' ? null : cells[3],
    })
  }
  return rows
}

function splitRoleTitle(heading: string): { title: string; company: string | null } {
  const at = heading.lastIndexOf(' at ')
  if (at === -1) {
    return { title: heading, company: null }
  }
  return { title: heading.slice(0, at).trim(), company: heading.slice(at + 4).trim() || null }
}

function toYearMonth(month: string, year: string): string | null {
  const value = MONTHS[month.slice(0, 3).toLowerCase()]
  if (!value) {
    return null
  }
  return `${year}-${String(value).padStart(2, '0')}`
}

function parseRoles(sections: ResumeSection[]): RoleSkeleton[] {
  const section = sections.find(s => s.heading === WORK_HISTORY_HEADING)
  if (!section) {
    return []
  }

  const roles: RoleSkeleton[] = []
  let title = ''
  let company: string | null = null
  let startedAt: string | null = null
  let endedAt: string | null = null
  let hasDates = false
  let inRole = false

  for (const line of section.body.split(/\r?\n/)) {
    if (line.startsWith('### ')) {
      if (inRole) {
        roles.push({ title, company, startedAt, endedAt })
      }
      const split = splitRoleTitle(line.slice(4).trim())
      title = split.title
      company = split.company
      startedAt = null
      endedAt = null
      hasDates = false
      inRole = true
      continue
    }

    if (inRole && !hasDates) {
      const match = line.match(DATE_RANGE_RE)
      if (match) {
        startedAt = toYearMonth(match[1], match[2])
        endedAt = toYearMonth(match[3], match[4])
        hasDates = true
      }
    }
  }

  if (inRole) {
    roles.push({ title, company, startedAt, endedAt })
  }

  return roles
}

export function chunkResume(resume: string): ChunkedResume {
  const sections = splitSections(resume)
  return {
    sections,
    skillsMatrix: parseSkillsMatrix(sections),
    roles: parseRoles(sections),
  }
}
