const NAPKIN_API = 'https://api.napkin.ai/v1'
const NAPKIN_KEY = process.env.NAPKIN_API_KEY!

interface NapkinJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: {
    images?: Array<{ url: string; width: number; height: number }>
  }
  error?: string
}

export interface DiagramResult {
  jobId: string
  imageUrls: string[]
}

/**
 * Submit a diagram generation job to Napkin AI.
 * Returns a job ID for polling.
 */
export async function generateDiagram(opts: {
  text: string          // The concept / key point to visualize
  title?: string        // Optional title for the diagram
  style?: 'clean' | 'sketch' | 'colorful'
}): Promise<string> {
  const res = await fetch(`${NAPKIN_API}/diagrams`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NAPKIN_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: opts.title ? `${opts.title}\n\n${opts.text}` : opts.text,
      style: opts.style ?? 'clean',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Napkin API error ${res.status}: ${body}`)
  }

  const data = await res.json()
  return data.id as string
}

/**
 * Poll a Napkin diagram job until it completes or fails.
 */
export async function pollDiagram(
  jobId: string,
  opts: { maxWaitMs?: number; intervalMs?: number } = {},
): Promise<DiagramResult> {
  const maxWait = opts.maxWaitMs ?? 120_000    // 2 minutes
  const interval = opts.intervalMs ?? 2_000    // poll every 2s
  const deadline = Date.now() + maxWait

  while (Date.now() < deadline) {
    const res = await fetch(`${NAPKIN_API}/diagrams/${jobId}`, {
      headers: { Authorization: `Bearer ${NAPKIN_KEY}` },
    })

    if (!res.ok) throw new Error(`Napkin poll error ${res.status}`)

    const job = (await res.json()) as NapkinJob

    if (job.status === 'completed') {
      const urls = (job.result?.images ?? []).map(img => img.url)
      return { jobId, imageUrls: urls }
    }

    if (job.status === 'failed') {
      throw new Error(`Napkin job ${jobId} failed: ${job.error ?? 'unknown'}`)
    }

    await new Promise(r => setTimeout(r, interval))
  }

  throw new Error(`Napkin job ${jobId} timed out after ${maxWait}ms`)
}

/**
 * Submit + poll in one call. Returns image URLs when done.
 * Use this for sequential (per-key-point) diagram generation.
 */
export async function generateAndWaitDiagram(opts: {
  text: string
  title?: string
  style?: 'clean' | 'sketch' | 'colorful'
}): Promise<DiagramResult> {
  const jobId = await generateDiagram(opts)
  return pollDiagram(jobId)
}

/**
 * Generate diagrams for all key points in parallel.
 * Returns array of DiagramResult in same order as input.
 * Failed diagrams are returned as empty imageUrls (non-blocking).
 */
export async function generateDiagramsForKeyPoints(
  keyPoints: string[],
  context: string,
): Promise<DiagramResult[]> {
  const results = await Promise.allSettled(
    keyPoints.map((kp, i) =>
      generateAndWaitDiagram({
        title: `${i + 1}. ${kp.slice(0, 60)}`,
        text: `${context}\n\nKey point: ${kp}`,
        style: 'clean',
      }),
    ),
  )

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { jobId: `failed-${i}`, imageUrls: [] },
  )
}
