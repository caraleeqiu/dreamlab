import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGeminiJson } from '@/lib/gemini'

// Science explainer narrative structure (Hook-Explain-Apply-Wonder)
const DEPTH_GUIDANCE: Record<string, { tone: string; vocab: string; analogyStyle: string }> = {
  beginner:     { tone: 'friendly and enthusiastic, like a curious friend', vocab: 'everyday language, no jargon', analogyStyle: 'simple daily-life analogies' },
  intermediate: { tone: 'engaging and informative, like a knowledgeable peer', vocab: 'some technical terms with brief explanations', analogyStyle: 'relatable but accurate analogies' },
  expert:       { tone: 'analytical and precise, like a domain expert', vocab: 'technical terminology, assumes background knowledge', analogyStyle: 'domain-specific analogies and examples' },
}

// Shot library for science explainer visuals
const SHOT_LIB_ZH = [
  '近景固定，主播直视镜头，配合手势讲解，浅色虚化背景',
  '特写面部，强调关键数据或结论，眼神自信',
  '中景动态，主播走动配合讲解，科技感背景',
  '俯拍视角，展示概念图示或实验画面',
  '仰拍英雄角度，讲述重大发现或结论',
]

const SHOT_LIB_EN = [
  'Medium close-up, host facing camera with expressive hand gestures, soft bokeh background',
  'Tight close-up on face, emphasizing key data or conclusion, confident eye contact',
  'Medium shot, host moving dynamically while explaining, tech-style background',
  'Top-down angle, illustrating conceptual diagrams or experiment visuals',
  'Low-angle hero shot, delivering a major discovery or conclusion',
]

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, influencerId, depth, durationS, platform, lang } = await request.json()
  if (!content || !influencerId) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const { data: influencer } = await supabase
    .from('influencers')
    .select('id, name, slug, tagline, personality, domains, speaking_style, catchphrases, type')
    .eq('id', influencerId)
    .single()
  if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })

  const isZh = lang !== 'en'
  const depthKey = ['beginner', 'intermediate', 'expert'].includes(depth) ? depth : 'intermediate'
  const guidance = DEPTH_GUIDANCE[depthKey]
  const clipCount = Math.max(2, Math.min(12, Math.floor(durationS / 15)))
  const clipDuration = Math.round(durationS / clipCount)
  const shotLib = isZh ? SHOT_LIB_ZH : SHOT_LIB_EN

  const personality = Array.isArray(influencer.personality) ? (influencer.personality as string[]).join(', ') : ''
  const catchphrases = Array.isArray(influencer.catchphrases) ? (influencer.catchphrases as string[]) : []

  const characterDossier = isZh
    ? `## 主播人设卡
角色：${influencer.name}
性格：${personality || influencer.tagline}
说话风格：${influencer.speaking_style || '自然流畅，亲切有趣'}
口头禅：${catchphrases.length ? catchphrases.map(c => `"${c}"`).join('、') : '无'}
台词要求：必须符合以上风格，不能OOC`
    : `## Host Character Card
Host: ${influencer.name}
Personality: ${personality || influencer.tagline}
Speaking style: ${influencer.speaking_style || 'natural, engaging, and friendly'}
Catchphrases: ${catchphrases.length ? catchphrases.map(c => `"${c}"`).join(', ') : 'none'}
Rule: dialogue must match this personality — no OOC`

  const scienceFramework = isZh
    ? `## 科普脚本结构（Hook-解释-应用-留白）
1. Hook（第1段）：用一个反常识事实或惊人问题开场，立刻抓住注意力。例："你知道吗？每次你呼吸，都有大约${Math.floor(Math.random() * 50 + 10000)}个原子曾经属于历史上某位名人。"
2. 背景（第2段，可选）：简单交代概念的历史或背景，1-2句。
3. 核心解释（中间${Math.max(1, clipCount - 3)}段）：用类比把复杂概念变简单。重点：类比要贴近日常生活。每段聚焦一个核心点。
4. 真实应用（倒数第2段）：这个原理在现实中怎么用？举一个具体案例。
5. 留白（最后1段）：用一个开放问题或惊人的未来可能性收尾，让观众意犹未尽。`
    : `## Science Script Structure (Hook-Explain-Apply-Wonder)
1. Hook (Clip 1): Open with a counterintuitive fact or shocking question. Grab attention immediately.
2. Context (Clip 2, optional): Brief 1-2 sentence background. Keep it short.
3. Core Explanation (Middle ${Math.max(1, clipCount - 3)} clips): Use analogies to simplify complex concepts. Each clip = one core idea. Make analogies relatable.
4. Real-World Application (2nd-to-last clip): How is this used in the real world? Give one concrete example.
5. Wonder (Last clip): End with an open question or a mind-blowing future possibility. Leave them wanting more.`

  const systemPrompt = isZh
    ? `你是专业科普视频编剧，擅长把复杂科学概念用生动、易懂的方式呈现给大众。
你的台词要自然口语化，听起来像真人在说话，而不是在读课本。
类比要贴近生活，数据要有画面感，结论要有冲击力。`
    : `You are a professional science video scriptwriter, expert at presenting complex science in vivid, accessible ways.
Your dialogue should sound natural and conversational — like someone actually talking, not reading a textbook.
Analogies must be relatable, data should be visual, conclusions should be impactful.`

  const userPrompt = isZh
    ? `${characterDossier}

---

${scienceFramework}

---

## 内容资料
标题：${content.title}
摘要：${content.summary}
核心要点：
${(content.keyPoints as string[]).map((k, i) => `${i + 1}. ${k}`).join('\n')}

## 生成要求
- 讲解深度：${depthKey === 'beginner' ? '入门级' : depthKey === 'intermediate' ? '进阶级' : '专业级'}
- 语气：${guidance.tone}
- 词汇：${guidance.vocab}
- 类比风格：${guidance.analogyStyle}
- 发布平台：${platform}
- 共 ${clipCount} 段，每段 ${clipDuration} 秒
- 台词每段不超过 ${clipDuration <= 10 ? 35 : 50} 字
- shot_description 用英文写（供 Kling 生成用）

示例镜头库（参考）：
${shotLib.map((s, i) => `${i + 1}. ${s}`).join('\n')}

严格返回 JSON 数组（不含 markdown 代码块）：
[
  {
    "index": 0,
    "speaker": "${influencer.slug || influencer.name}",
    "dialogue": "台词（自然口语，${clipDuration}秒内说完）",
    "shot_description": "English cinematic shot description for Kling video generation",
    "duration": ${clipDuration}
  }
]

生成恰好 ${clipCount} 个片段。`
    : `${characterDossier}

---

${scienceFramework}

---

## Content
Title: ${content.title}
Summary: ${content.summary}
Key Points:
${(content.keyPoints as string[]).map((k, i) => `${i + 1}. ${k}`).join('\n')}

## Requirements
- Depth: ${depthKey}
- Tone: ${guidance.tone}
- Vocabulary: ${guidance.vocab}
- Analogy style: ${guidance.analogyStyle}
- Platform: ${platform}
- ${clipCount} clips, each ${clipDuration} seconds
- Dialogue: max ${clipDuration <= 10 ? 20 : 35} words per clip
- shot_description in English (for Kling video generation)

Sample shot library (reference):
${shotLib.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Return strict JSON array (no markdown code blocks):
[
  {
    "index": 0,
    "speaker": "${influencer.slug || influencer.name}",
    "dialogue": "Spoken text (fits naturally in ${clipDuration}s)",
    "shot_description": "Cinematic shot description for Kling",
    "duration": ${clipDuration}
  }
]

Return exactly ${clipCount} clips.`

  try {
    const script = await callGeminiJson<Record<string, unknown>[]>({ systemPrompt, userPrompt })
    if (!Array.isArray(script)) throw new Error('Expected array')
    return NextResponse.json({ script })
  } catch (err) {
    return NextResponse.json({ error: `生成失败: ${(err as Error).message}` }, { status: 500 })
  }
}
