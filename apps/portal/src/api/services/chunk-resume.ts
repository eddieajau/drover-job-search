/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { sectionTypeFor, splitH3Children, splitSections, type ChunkedResume } from './resume-sections.js'

export type { ChunkedResume, ResumeChild, ResumeSection, SectionType } from './resume-sections.js'

// Slices a resume into `##` sections, inferring a category per section from
// its title and collecting `###` children so the LLM can evaluate each chunk
// separately. Never guesses at content: a document without level-2 headings
// becomes one `other` section wrapping the whole body, and an empty document
// slices to nothing.
export function chunkResume(resume: string): ChunkedResume {
  const trimmed = resume.trim()
  if (trimmed === '') {
    return { sections: [] }
  }

  const raw = splitSections(resume)
  if (raw.length === 0) {
    return {
      sections: [
        {
          title: '',
          category: 'other',
          body: trimmed,
          children: [{ title: '', body: trimmed }],
        },
      ],
    }
  }

  return {
    sections: raw.map(section => ({
      title: section.title,
      category: sectionTypeFor(section.title),
      body: section.body,
      children: splitH3Children(section.body),
    })),
  }
}
