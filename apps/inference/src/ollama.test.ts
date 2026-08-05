import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

import { createOllamaClient } from './ollama.js'

describe('createOllamaClient', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends correct request shape', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ response: '{"score":50}', done: true }),
    })

    const client = createOllamaClient('http://localhost:11434', 'test-model')
    const result = await client.generate('test prompt')

    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'test-model',
        prompt: 'test prompt',
        stream: false,
        format: 'json',
      }),
    })
    expect(result).toBe('{"score":50}')
  })

  it('throws on non-ok response', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'error body',
    })

    const client = createOllamaClient('http://localhost:11434', 'test-model')
    await expect(client.generate('test')).rejects.toThrow('ollama generate failed: 500 Internal Server Error')
  })

  it('uses default base URL and model when not provided', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ response: '{}', done: true }),
    })

    const client = createOllamaClient()
    await client.generate('prompt')

    const call = fetchSpy.mock.calls[0]
    expect(call[0]).toBe('http://127.0.0.1:11434/api/generate')
    const body = JSON.parse(call[1].body)
    expect(body.model).toBe('llama3.2')
  })

  it('uses thinking field when response is empty', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          response: '',
          thinking: '{"score":85,"signal_type":"skill_match","matched_keywords":[],"reason":"test"}',
          done: true,
        }),
    })

    const client = createOllamaClient('http://localhost:11434', 'test-model')
    const result = await client.generate('test prompt')

    expect(result).toBe('{"score":85,"signal_type":"skill_match","matched_keywords":[],"reason":"test"}')
  })
})
