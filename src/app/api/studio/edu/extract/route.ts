import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

const GEMINI_KEY = process.env.GEMINI_API_KEY!
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// POST /api/studio/edu/extract
// Body: { input: string (URL or concept text), lang }
// Returns: { title, summary, keyPoints, difficulty, suggestedDuration, sourceType }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { input, lang } = await request.json() as { input?: string; lang?: string }
  if (!input?.trim()) return NextResponse.json({ error: 'input required' }, { status: 400 })

  const isZh = lang !== 'en'
  let content = input.trim()
  let sourceType: 'url' | 'text' = 'text'

  // If URL, fetch via Jina reader
  if (/^https?:\/\//i.test(content)) {
    sourceType = 'url'
    try {
      const jinaUrl = `https://r.jina.ai/${content}`
      const jinaHeaders: Record<string, string> = { Accept: 'text/plain', 'X-Return-Format': 'text' }
      if (process.env.JINA_API_KEY) jinaHeaders['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`
      const jinaRes = await fetch(jinaUrl, { headers: jinaHeaders, signal: AbortSignal.timeout(15000) })
      if (jinaRes.ok) {
        const text = await jinaRes.text()
        if (text.trim()) content = text.slice(0, 10000)
      }
    } catch {
      // Fall back to treating input as concept text
    }
  }

  const prompt = isZh
    ? `你是科普内容策划专家。请从以下内容中提炼出适合做科普视频的结构化信息。

内容：
${content}

请分析内容，输出 JSON（不含 markdown 代码块）：
{
  "title": "内容的核心标题（10字以内，适合做视频标题）",
  "summary": "核心摘要（100-150字，用通俗语言，适合口播朗读）",
  "keyPoints": ["核心要点1", "核心要点2", "核心要点3"],
  "difficulty": "beginner | intermediate | expert（根据内容复杂度判断）",
  "suggestedDuration": 60
}

要求：
- keyPoints 控制在 3-5 个，每条不超过 30 字
- suggestedDuration 单位秒，根据内容复杂度建议 30/60/90/120
- summary 要口语化，像在和朋友讲解`
    : `You are a science content strategist. Extract structured information suitable for a science explainer video from the content below.

Content:
${content}

Output JSON (no markdown code blocks):
{
  "title": "Core title (under 8 words, suitable for video title)",
  "summary": "Core summary (80-120 words, conversational, suitable for voiceover)",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "difficulty": "beginner | intermediate | expert",
  "suggestedDuration": 60
}

Rules:
- 3-5 keyPoints, each under 15 words
- suggestedDuration in seconds, suggest 30/60/90/120 based on complexity
- summary should be conversational, like explaining to a friend`

  const geminiRes = await fetch(
    `${GEMINI_BASE}/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    }
  )

  const geminiData = await geminiRes.json()
  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return NextResponse.json({ error: 'AI 提炼失败' }, { status: 500 })

  try {
    const parsed = JSON.parse(text)
    return NextResponse.json({
      title: parsed.title || '',
      summary: parsed.summary || '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 5) : [],
      difficulty: ['beginner', 'intermediate', 'expert'].includes(parsed.difficulty) ? parsed.difficulty : 'intermediate',
      suggestedDuration: Number(parsed.suggestedDuration) || 60,
      sourceType,
    })
  } catch {
    return NextResponse.json({ error: '解析失败' }, { status: 500 })
  }
}
