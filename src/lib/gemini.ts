import { createLogger } from './logger'

const logger = createLogger('gemini')

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL   = 'gemini-2.0-flash'
const DEFAULT_TIMEOUT = 60_000   // 60s per attempt
const DEFAULT_RETRIES = 3

interface GeminiParams {
  systemPrompt: string
  userPrompt: string
  model?: string
  timeoutMs?: number
  retries?: number
  responseMimeType?: string
}

/**
 * Call Gemini with automatic retry + per-attempt timeout.
 *
 * Retries on:
 *   - Network errors (fetch throws)
 *   - HTTP 429 / 503 (rate limit / overload)
 *   - Empty or non-parseable response
 *
 * Does NOT retry on:
 *   - HTTP 400 (bad request — fix the prompt)
 *   - HTTP 401 / 403 (key issue)
 *
 * Returns raw text from the model.
 */
export async function callGemini(params: GeminiParams): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    model         = DEFAULT_MODEL,
    timeoutMs     = DEFAULT_TIMEOUT,
    retries       = DEFAULT_RETRIES,
    responseMimeType = 'application/json',
  } = params

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userPrompt }] }],
    generationConfig: { responseMimeType },
  })

  let lastErr: unknown
  for (let attempt = 0; attempt < retries; attempt++) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ac.signal,
      })

      clearTimeout(timer)

      // Non-retryable client errors
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        const errBody = await res.text()
        throw new Error(`Gemini ${res.status}: ${errBody.slice(0, 200)}`)
      }

      // Retryable server errors
      if (!res.ok) {
        const errBody = await res.text()
        lastErr = new Error(`Gemini HTTP ${res.status}: ${errBody.slice(0, 200)}`)
        logger.warn('Gemini retryable error', { attempt, status: res.status })
        await sleep(1000 * Math.pow(2, attempt))
        continue
      }

      const data = await res.json()
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (!text) {
        lastErr = new Error('Gemini returned empty response')
        logger.warn('Gemini empty response', { attempt, data: JSON.stringify(data).slice(0, 300) })
        await sleep(1000 * Math.pow(2, attempt))
        continue
      }

      return text

    } catch (err) {
      clearTimeout(timer)
      lastErr = err
      const isAbort = (err as Error)?.name === 'AbortError'
      if (isAbort) {
        logger.warn('Gemini timeout', { attempt, timeoutMs })
      } else {
        logger.warn('Gemini fetch error', { attempt, err: String(err) })
      }
      // Non-retryable errors bubble immediately
      const msg = String((err as Error)?.message ?? '')
      if (msg.includes('Gemini 400') || msg.includes('Gemini 401') || msg.includes('Gemini 403')) {
        throw err
      }
      if (attempt < retries - 1) {
        await sleep(1000 * Math.pow(2, attempt))
      }
    }
  }

  throw lastErr ?? new Error('Gemini call failed after retries')
}

/**
 * Convenience wrapper that parses the Gemini response as JSON.
 * Strips markdown code fences if present.
 */
export async function callGeminiJson<T>(params: GeminiParams): Promise<T> {
  const text = await callGemini({ ...params, responseMimeType: 'application/json' })
  // Strip ``` code fences that some model versions still emit
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    logger.error('Gemini JSON parse failed', { raw: cleaned.slice(0, 500) })
    throw new Error(`Gemini response is not valid JSON: ${cleaned.slice(0, 200)}`)
  }
}

/**
 * Gemini Vision call — accepts inline image data (JPEG/PNG buffers) alongside text.
 * Used for video keyframe analysis: send N extracted frames + analysis prompt.
 * Returns parsed JSON of type T.
 */
export async function callGeminiVision<T>(params: {
  textPrompt: string
  imageBuffers: Buffer[]   // JPEG buffers (up to 16 images per call)
  mimeType?: string
  model?: string
  timeoutMs?: number
}): Promise<T> {
  const {
    textPrompt,
    imageBuffers,
    mimeType = 'image/jpeg',
    model = 'gemini-2.0-flash',
    timeoutMs = 90_000,
  } = params

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`

  const imageParts = imageBuffers.map(buf => ({
    inline_data: { mime_type: mimeType, data: buf.toString('base64') },
  }))

  const body = JSON.stringify({
    contents: [{
      parts: [
        ...imageParts,
        { text: textPrompt },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json' },
  })

  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ac.signal,
      })
      clearTimeout(timer)
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new Error(`Gemini Vision ${res.status}: ${(await res.text()).slice(0, 200)}`)
      }
      if (!res.ok) {
        lastErr = new Error(`Gemini Vision HTTP ${res.status}`)
        await sleep(1000 * Math.pow(2, attempt))
        continue
      }
      const data = await res.json()
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) { lastErr = new Error('Gemini Vision empty response'); await sleep(1000 * Math.pow(2, attempt)); continue }
      const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      return JSON.parse(cleaned) as T
    } catch (err) {
      clearTimeout(timer)
      lastErr = err
      const msg = String((err as Error)?.message ?? '')
      if (msg.includes('Gemini Vision 400') || msg.includes('Gemini Vision 401') || msg.includes('Gemini Vision 403')) throw err
      if (attempt < 2) await sleep(1000 * Math.pow(2, attempt))
    }
  }
  throw lastErr ?? new Error('Gemini Vision failed after retries')
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
