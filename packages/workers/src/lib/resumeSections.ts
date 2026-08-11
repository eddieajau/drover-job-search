/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

export type SectionType = 'summary' | 'experience' | 'skills' | 'projects' | 'education' | 'hobbies' | 'other'

export interface ResumeChild {
  title: string
  body: string
}

export interface ResumeSection {
  title: string
  category: SectionType
  body: string
  children: ResumeChild[]
}

export interface ChunkedResume {
  sections: ResumeSection[]
}

// Headings are categorised by keyword, never exact string: `Professional
// Summary` and `Summary` both map to `summary`, `Technical` and
// `Skills & Competencies Matrix` both map to `skills`, and so on. Anything
// else is `other` — structured content with no known format, still sliced for
// the LLM rather than dropped.
const SECTION_TYPE_KEYWORDS: ReadonlyArray<{ type: SectionType; keywords: readonly string[] }> = [
  { type: 'summary', keywords: ['summary', 'profile', 'overview', 'objective'] },
  {
    type: 'experience',
    keywords: ['work history', 'professional experience', 'employment history', 'work experience'],
  },
  { type: 'skills', keywords: ['skill', 'technical', 'competenc', 'technolog', 'matrix', 'stack'] },
  { type: 'projects', keywords: ['project', 'portfolio', 'built', 'open source', 'agentic'] },
  { type: 'education', keywords: ['educat', 'qualif', 'academ', 'universit', 'college', 'degree'] },
  { type: 'hobbies', keywords: ['hobbie', 'interest', 'leisure'] },
]

export function sectionTypeFor(title: string): SectionType {
  const lower = title.toLowerCase()
  for (const { type, keywords } of SECTION_TYPE_KEYWORDS) {
    if (keywords.some(keyword => lower.includes(keyword))) {
      return type
    }
  }
  return 'other'
}

// Splits a resume on `## ` headings into `{ title, body }` pairs. Returns []
// when the document has no level-2 headings.
export function splitSections(resume: string): Array<{ title: string; body: string }> {
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

  const sections: Array<{ title: string; body: string }> = []
  for (let i = 0; i < headingLines.length; i++) {
    const start = headingLines[i]
    const end = i + 1 < headingLines.length ? headingLines[i + 1] : lines.length
    sections.push({
      title: lines[start].slice(3).trim(),
      body: lines
        .slice(start + 1, end)
        .join('\n')
        .trim(),
    })
  }
  return sections
}

// Collects `### ` chunks from a section body as slicing units for the LLM.
// Leading prose before the first `###` is scene-setting and is not a chunk.
export function splitH3Children(body: string): ResumeChild[] {
  const children: ResumeChild[] = []
  let current: { title: string; lines: string[] } | null = null

  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith('### ')) {
      if (current) {
        children.push({ title: current.title, body: current.lines.join('\n').trim() })
      }
      current = { title: line.slice(4).trim(), lines: [line] }
    } else if (current) {
      current.lines.push(line)
    }
  }

  if (current) {
    children.push({ title: current.title, body: current.lines.join('\n').trim() })
  }

  return children
}
