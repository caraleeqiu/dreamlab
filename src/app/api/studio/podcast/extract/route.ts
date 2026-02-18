import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60 // seconds

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

  let rawText = ''
  let sourceTitle = ''

  if (url?.trim()) {
    // Jina AI Reader — handles articles, YouTube transcripts, PDFs via URL
    const jinaUrl = `https://r.jina.ai/${url.trim()}`
    const headers: Record<string, string> = { 'Accept': 'text/plain', 'X-Return-Format': 'text' }
    if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`

    const jinaRes = await fetch(jinaUrl, { headers, signal: AbortSignal.timeout(30000) })
    if (!jinaRes.ok) return NextResponse.json({ error: `无法读取链接内容 (${jinaRes.status})` }, { status: 422 })
    rawText = await jinaRes.text()
    // Jina returns title as the first # heading
    sourceTitle = rawText.split('\n').find(l => l.startsWith('# '))?.replace(/^#+ /, '').trim() || url

  } else if (file) {
    // Local PDF extraction via unpdf
    const { extractText } = await import('unpdf')
    const buffer = await file.arrayBuffer()
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })
    rawText = text
    sourceTitle = file.name.replace(/\.pdf$/i, '')

  } else {
    return NextResponse.json({ error: 'Must provide url or file' }, { status: 400 })
  }

  if (!rawText.trim()) return NextResponse.json({ error: '内容为空，请检查链接或文件' }, { status: 422 })

  // Trim to ~60K chars (~15K tokens) — enough for most books without hitting limits
  const trimmed = rawText.slice(0, 60000)

  const systemPrompt = isZh
    ? `你是专业的内容分析师，擅长从书籍、文章中提炼核心观点，帮助播客主持人快速把握内容精华。`
    : `You are a professional content analyst who extracts core insights from books and articles for podcast hosts.`

  const userPrompt = isZh
    ? `请分析以下内容，提炼 10-15 个核心观点（类似拆书笔记）。
每个观点包含：
- title：简洁标题（10-20字）
- summary：一句话说明为什么这个观点重要（20-40字）

严格返回 JSON：
{"source_title": "内容标题", "concepts": [{"title": "...", "summary": "..."}, ...]}

内容：
${trimmed}`
    : `Analyze the following content and extract 10-15 core concepts (like book notes).
Each concept:
- title: concise title (5-15 words)
- summary: one sentence on why this matters (10-25 words)

Return strict JSON:
{"source_title": "content title", "concepts": [{"title": "...", "summary": "..."}, ...]}

Content:
${trimmed}`

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )

  const geminiData = await geminiRes.json()
  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return NextResponse.json({ error: 'AI 解析失败' }, { status: 500 })

  try {
    const parsed = JSON.parse(text)
    return NextResponse.json({
      source_title: parsed.source_title || sourceTitle,
      concepts: parsed.concepts || [],
    })
  } catch {
    return NextResponse.json({ error: '解析失败', raw: text }, { status: 500 })
  }
}
