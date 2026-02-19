import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Influencer } from '@/types'

const GEMINI_KEY = process.env.GEMINI_API_KEY!
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// POST /api/studio/edu/paper/script
// Generate a paper explainer script aligned with Napkin diagram topics.
// One ScriptClip per key point — each clip references its diagram as a visual backing.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, influencer, diagrams, platform, aspectRatio, lang } = await req.json()
  if (!content || !influencer || !diagrams) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const isZh = lang !== 'en'
  const inf = influencer as Influencer
  const personality = Array.isArray(inf.personality) ? (inf.personality as string[]).join(', ') : ''
  const catchphrases = Array.isArray(inf.catchphrases) ? (inf.catchphrases as string[]) : []

  // Character dossier to keep the influencer in-character
  const dossier = isZh
    ? `## 主播设定
角色：${inf.name}
定位：${inf.tagline}
性格：${personality || inf.tagline}
说话风格：${inf.speaking_style || '清晰、专业、有感染力'}
口头禅：${catchphrases.length ? catchphrases.map((c: string) => `"${c}"`).join('、') : '无'}
关键要求：每段台词必须符合角色人设，绝对不能说出人物以外的话`
    : `## Host Character Card
Character: ${inf.name}
Tagline: ${inf.tagline}
Personality: ${personality || inf.tagline}
Speaking style: ${inf.speaking_style || 'clear, professional, engaging'}
Catchphrases: ${catchphrases.length ? catchphrases.map((c: string) => `"${c}"`).join(', ') : 'none'}
Rule: Every dialogue line MUST sound like ${inf.name}. Never break character.`

  const keyPoints: string[] = content.keyPoints ?? []
  const clipCount = keyPoints.length + 1  // hook + one per key point

  const prompt = isZh
    ? `你是专业的科普视频编剧，擅长将学术论文改编成网红口播解读视频。
脚本要清晰、通俗、有吸引力，每段紧扣对应的分镜概念图。

${dossier}

---

## 论文内容
标题：${content.title}
摘要：${content.summary}
难度：${content.difficulty}
核心要点（每个要点对应一张 Napkin 分镜图）：
${keyPoints.map((kp, i) => `${i + 1}. ${kp}`).join('\n')}

---

## 脚本结构
生成恰好 ${clipCount} 段：
- 第 0 段（钩子）：5秒的开场，用一个让观众立刻想看下去的问题或惊人事实。
- 第 1–${keyPoints.length} 段：每段对应一个要点，通俗解释该要点，引用分镜图中的概念。每段 8–10 秒。

---

## 输出格式
严格返回 JSON 数组，不含 markdown 代码块：
[
  {
    "clip_index": 0,
    "shot_description": "Detailed English visual description for Kling: character pose/expression, what part of diagram background to focus on, any annotation hints",
    "dialogue": "台词内容（符合角色人设）",
    "duration": 5,
    "shot_type": "medium",
    "camera_movement": "static",
    "diagram_index": -1
  }
]
注意：
- diagram_index 是对应知识点的 0-based 索引（第0段 hook 用 -1 或 0）
- shot_description 用英文（供 Kling 理解），dialogue 用中文
- 台词要口语化、不像读论文，要有角色的说话风格`
    : `You are a professional science video scriptwriter, specializing in turning academic papers into influencer explainer videos.
Scripts must be clear, accessible, and engaging — each clip tied to its concept diagram.

${dossier}

---

## Paper Content
Title: ${content.title}
Summary: ${content.summary}
Difficulty: ${content.difficulty}
Key Points (each matches one Napkin concept diagram):
${keyPoints.map((kp, i) => `${i + 1}. ${kp}`).join('\n')}

---

## Script Structure
Generate exactly ${clipCount} clips:
- Clip 0 (HOOK): 5-second opener — a question or surprising fact that makes viewers want to keep watching.
- Clips 1–${keyPoints.length}: One per key point, 8-10 seconds each, explaining the concept conversationally while referencing the concept diagram.

---

## Output Format
Return strict JSON array, no markdown:
[
  {
    "clip_index": 0,
    "shot_description": "Detailed English visual description for Kling: character pose/expression, what part of diagram background to highlight, annotation hints",
    "dialogue": "What the host says (in-character voice)",
    "duration": 5,
    "shot_type": "medium",
    "camera_movement": "static",
    "diagram_index": 0
  }
]
Notes:
- diagram_index: 0-based index of the key point this clip references (-1 for hook if no specific diagram)
- shot_description in English (for Kling), dialogue in ${isZh ? 'Chinese' : 'English'}
- Dialogue must be conversational, NOT like reading a paper`

  try {
    const res = await fetch(
      `${GEMINI_BASE}/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.75, maxOutputTokens: 4096 },
        }),
      },
    )
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return NextResponse.json({ error: 'Script generation failed' }, { status: 500 })
    const script = JSON.parse(text)
    if (!Array.isArray(script)) throw new Error('Expected array')
    return NextResponse.json({ script })
  } catch (e) {
    console.error('edu/paper/script error:', e)
    return NextResponse.json({ error: 'Script generation failed' }, { status: 500 })
  }
}
