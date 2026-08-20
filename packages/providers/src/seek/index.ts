/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import type { Provider } from '../common/index.js'

export { parseSeekJob, type SeekJobDetail } from './parse.js'

export { toJob } from './toJob.js'

const SEEK_URL_RE = /^https?:\/\/au\.seek\.com\/job\/(\d+)$/

export const provider: Provider = {
  name: 'seek',
  isMatch: url => SEEK_URL_RE.test(url),
  toJob: (url, logger) => import('./toJob.js').then(m => m.toJob(url, logger)),
}

export { SEEK_URL_RE }
