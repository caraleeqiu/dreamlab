import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GEMINI_KEY = process.env.GEMINI_API_KEY!
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Visual style guidance for cinematic AI animation (no character reference)
const VISUAL_STYLES: Record<string, string> = {
  cinematic:  'Cinematic realism, dramatic lighting, film-grade color grading, depth of field',
  anime:      'Premium anime animation, vibrant colors, expressive linework, dynamic compositions',
  watercolor: 'Watercolor illustration, soft washes, organic textures, artistic impressionism',
  abstract:   'Abstract geometric animation, bold shapes, flowing motion, modern design language',
  scifi:      'Sci-fi futuristic visualization, holographic UI, neon accents, space vistas',
  nature:     'Nature documentary style, macro photography, golden hour lighting, rich textures',
}

// POST /api/studio/edu/cinematic/script
// Generate a pure scene-animation script — NO talking head, NO character.
// Each clip is a cinematic visual scene with optional voiceover text.
// All clips marked provider:'seedance' (fall back to Kling text2video for now).
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, visualStyle, durationS, platform, lang } = await request.json()
  if (!content) return NextResponse.json({ error: 'Missing content' }, { status: 400 })

  const isZh = lang !== 'en'
  const styleKey = Object.keys(VISUAL_STYLES).includes(visualStyle) ? visualStyle : 'cinematic'
  const styleDesc = VISUAL_STYLES[styleKey]
  const clipCount = Math.max(3, Math.min(12, Math.round((durationS || 60) / 8)))
  const clipDuration = Math.round((durationS || 60) / clipCount)

  const prompt = isZh
    ? `你是专业的科普动画导演，擅长用纯视觉画面（无真人出镜）讲述科学故事。
你的脚本要像纪录片镜头语言，每一帧都有视觉冲击力，让观众在不需要任何人讲解的情况下理解科学概念。

## 内容
标题：${content.title}
核心概念：${content.summary}
关键要点：
${(content.keyPoints as string[]).map((k, i) => `${i + 1}. ${k}`).join('\n')}

## 视觉风格
${styleDesc}

## 要求
- 共 ${clipCount} 个场景，每段 ${clipDuration} 秒
- 无真人、无虚拟角色——只有场景、物体、数据可视化、自然现象
- 每段有一句简短的旁白文本（voiceover）供后期配音使用
- shot_description 要极其详细：主体、构图、光线、运动、颜色
- 用视觉比喻和具象化来解释抽象科学概念
- 整体叙事弧线：问题→探索→揭示→宏观视角

严格返回 JSON 数组（不含 markdown 代码块）：
[
  {
    "index": 0,
    "speaker": "narrator",
    "dialogue": "",
    "voiceover": "旁白文本（一句话，适合 ${clipDuration}s 朗读）",
    "shot_description": "Detailed English cinematic scene description: subject + composition + lighting + motion + color palette + ${styleDesc}",
    "duration": ${clipDuration},
    "shot_type": "wide|medium|close-up|macro|aerial|pov",
    "camera_movement": "static|pan|tilt|dolly|zoom|handheld|orbit",
    "provider": "seedance"
  }
]

生成恰好 ${clipCount} 个场景。`
    : `You are a professional science animation director, expert at telling science stories through pure visuals (no on-screen presenter).
Your scripts use documentary cinematography language — every frame has visual impact, making science understandable without narration.

## Content
Title: ${content.title}
Core concept: ${content.summary}
Key points:
${(content.keyPoints as string[]).map((k, i) => `${i + 1}. ${k}`).join('\n')}

## Visual Style
${styleDesc}

## Requirements
- ${clipCount} scenes, each ${clipDuration} seconds
- No presenters, no virtual characters — only environments, objects, data visualizations, natural phenomena
- Each clip has a short voiceover line for post-production dubbing
- shot_description must be extremely detailed: subject + composition + lighting + motion + color
- Use visual metaphors and concrete imagery to explain abstract concepts
- Overall arc: problem → exploration → revelation → cosmic perspective

Return strict JSON array (no markdown):
[
  {
    "index": 0,
    "speaker": "narrator",
    "dialogue": "",
    "voiceover": "One sentence voiceover (fits ${clipDuration}s of reading)",
    "shot_description": "Detailed English cinematic scene description: subject + composition + lighting + motion + color palette + ${styleDesc}",
    "duration": ${clipDuration},
    "shot_type": "wide|medium|close-up|macro|aerial|pov",
    "camera_movement": "static|pan|tilt|dolly|zoom|handheld|orbit",
    "provider": "seedance"
  }
]

Return exactly ${clipCount} scenes.`

  try {
    const res = await fetch(
      `${GEMINI_BASE}/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.85,
            maxOutputTokens: 4096,
          },
        }),
      },
    )
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return NextResponse.json({ error: 'Script generation failed' }, { status: 500 })
    const script = JSON.parse(text)
    if (!Array.isArray(script)) throw new Error('Expected array')
    return NextResponse.json({ script, styleDesc })
  } catch (e) {
    console.error('edu/cinematic/script error:', e)
    return NextResponse.json({ error: 'Script generation failed' }, { status: 500 })
  }
}
