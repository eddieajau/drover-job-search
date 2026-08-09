/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

interface Logger {
  debug?(obj: object, msg?: string): void
  info?(obj: object, msg?: string): void
  warn?(obj: object, msg?: string): void
  error?(obj: object, msg?: string): void
}

export interface OllamaGenerateResponse {
  response: string
  thinking?: string
  done: boolean
}

export interface OllamaClient {
  generate(prompt: string): Promise<string>
}

export function createOllamaClient(
  baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
  model = process.env.OLLAMA_MODEL ?? 'llama3.2',
  log?: Logger
): OllamaClient {
  return {
    async generate(prompt: string): Promise<string> {
      const url = `${baseUrl}/api/generate`
      const body = JSON.stringify({ model, prompt, stream: false, format: 'json' })

      log?.debug?.({ url, model, promptLength: prompt.length }, 'ollama request')

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '')
        log?.error?.({ status: res.status, statusText: res.statusText, body: errorBody }, 'ollama HTTP error')
        throw new Error(`ollama generate failed: ${res.status} ${res.statusText}`)
      }

      const raw = await res.text()
      log?.debug?.({ rawLength: raw.length, rawPreview: raw.slice(0, 500) }, 'ollama raw response body')

      const data = JSON.parse(raw) as OllamaGenerateResponse & Record<string, unknown>
      log?.debug?.(
        { responseLength: data.response?.length ?? 0, thinkingLength: data.thinking?.length ?? 0 },
        'ollama response parsed'
      )

      const content = data.response || data.thinking || ''
      return content
    },
  }
}
