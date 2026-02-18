import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

const GEMINI_KEY = process.env.GEMINI_API_KEY!
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// POST /api/studio/podcast/extract
// FormData: { url?: string, file?: File (PDF), language?: string }
// Returns: { source_title: string, concepts: Array<{title: string, summary: string}> }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const url = formData.get('url') as string | null
  const file = formData.get('file') as File | null
  const language = (formData.get('language') as string) || 'zh'
  const isZh = language !== 'en'

  const systemPrompt = isZh
    ? `你是专业的内容分析师，擅长从书籍、文章中提炼核心观点，帮助播客主持人快速把握内容精华。`
    : `You are a professional content analyst who extracts core insights from books and articles for podcast hosts.`

  const conceptInstruction = isZh
    ? `请分析内容，提炼 10-15 个核心观点（类似拆书笔记）。
每个观点包含：
- title：简洁标题（10-20字）
- summary：一句话说明为什么这个观点重要（20-40字）

严格返回 JSON（不要 markdown 代码块）：
{"source_title": "内容标题", "concepts": [{"title": "...", "summary": "..."}, ...]}`
    : `Analyze the content and extract 10-15 core concepts (like book notes).
Each concept:
- title: concise title (5-15 words)
- summary: one sentence on why this matters (10-25 words)

Return strict JSON (no markdown code blocks):
{"source_title": "content title", "concepts": [{"title": "...", "summary": "..."}, ...]}`

  let geminiBody: object

  if (url?.trim()) {
    // Step 1: Jina AI Reader — strips nav/ads, returns clean article text
    const jinaUrl = `https://r.jina.ai/${url.trim()}`
    const jinaHeaders: Record<string, string> = { 'Accept': 'text/plain', 'X-Return-Format': 'text' }
    if (process.env.JINA_API_KEY) jinaHeaders['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`

    const jinaRes = await fetch(jinaUrl, { headers: jinaHeaders, signal: AbortSignal.timeout(30000) })
    if (!jinaRes.ok) return NextResponse.json({ error: `无法读取链接内容 (${jinaRes.status})` }, { status: 422 })

    const rawText = await jinaRes.text()
    if (!rawText.trim()) return NextResponse.json({ error: '内容为空，请检查链接' }, { status: 422 })

    // Trim to ~60K chars to stay within token limits
    const trimmed = rawText.slice(0, 60000)

    // Step 2: Gemini extracts concepts from the clean text
    geminiBody = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: `${conceptInstruction}\n\n内容：\n${trimmed}` }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }

  } else if (file) {
    // PDF: upload to Gemini Files API, Gemini reads it natively
    const fileUri = await uploadToGeminiFiles(file)

    geminiBody = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{
        parts: [
          { fileData: { mimeType: 'application/pdf', fileUri } },
          { text: conceptInstruction },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json' },
    }

  } else {
    return NextResponse.json({ error: 'Must provide url or file' }, { status: 400 })
  }

  const geminiRes = await fetch(
    `${GEMINI_BASE}/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
  )

  const geminiData = await geminiRes.json()
  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    console.error('Gemini extract error:', JSON.stringify(geminiData))
    return NextResponse.json({ error: 'AI 解析失败' }, { status: 500 })
  }

  try {
    const parsed = JSON.parse(text)
    return NextResponse.json({
      source_title: parsed.source_title || (file ? file.name.replace(/\.pdf$/i, '') : url),
      concepts: parsed.concepts || [],
    })
  } catch {
    return NextResponse.json({ error: '解析失败', raw: text }, { status: 500 })
  }
}

// Upload PDF to Gemini Files API, return the hosted file URI
async function uploadToGeminiFiles(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const boundary = '---GeminiUpload'

  const metaPart = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ file: { displayName: file.name } })}\r\n`
  )
  const dataHeader = new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`)
  const end = new TextEncoder().encode(`\r\n--${boundary}--`)

  const body = new Uint8Array(metaPart.length + dataHeader.length + bytes.length + end.length)
  body.set(metaPart, 0)
  body.set(dataHeader, metaPart.length)
  body.set(bytes, metaPart.length + dataHeader.length)
  body.set(end, metaPart.length + dataHeader.length + bytes.length)

  const uploadRes = await fetch(
    `${GEMINI_BASE.replace('v1beta', 'upload/v1beta')}/files?uploadType=multipart&key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'X-Goog-Upload-Protocol': 'multipart',
      },
      body,
    }
  )

  const uploadData = await uploadRes.json()
  const fileUri = uploadData?.file?.uri
  if (!fileUri) throw new Error('Gemini Files upload failed: ' + JSON.stringify(uploadData))
  return fileUri
}
