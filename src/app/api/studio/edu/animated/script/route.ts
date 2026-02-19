import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGeminiJson } from '@/lib/gemini'

const ANIME_STYLE_PROMPTS: Record<string, string> = {
  cyberpunk: 'Cyberpunk aesthetic, neon lights, futuristic cityscape, high-tech atmosphere',
  ancient:   'Traditional Chinese painting style, ink wash, elegant oriental aesthetics',
  modern:    'Modern urban style, fashionable lifestyle scenes, clean composition',
  cute:      'Cute anime style, kawaii, pastel colors, expressive character',
  fantasy:   'Fantasy magic world, epic lighting, colorful special effects, mystical atmosphere',
  minimal:   'Minimalist, pure background, premium quality, elegant simplicity',
}

// Science story arc: problem → discovery → dramatization → resolution
const STORY_ARC_ZH = `## 动画科普故事结构（角色驱动科学发现）
1. 建立困境（第1段）：角色遇到一个和科学概念相关的真实问题或挑战。不要直接讲原理，先讲困境。
2. 探索阶段（第2段）：角色开始探索、发现线索，引出核心科学原理。
3. 科学揭示（中间段）：用视觉化、戏剧化的方式演绎科学原理。把抽象概念具象化为角色的行动和场景。
4. 转折应用（倒数第2段）：科学原理帮助角色解决了问题，有一个"啊哈！"时刻。
5. 收尾启发（最后1段）：轻松有趣的结尾，带一个科学启示或小问题留给观众。`

const STORY_ARC_EN = `## Animated Science Story Structure (Character-Driven Discovery)
1. Problem (Clip 1): Character faces a real challenge connected to the science concept. Don't explain the science yet — show the problem.
2. Exploration (Clip 2): Character starts investigating, hints emerge at the core science principle.
3. Scientific Revelation (Middle clips): Dramatize the science visually. Turn abstract concepts into character actions and scenes.
4. Application & Breakthrough (2nd-to-last): The science helps the character solve the problem — an "aha!" moment.
5. Inspiring Close (Last clip): Light, fun ending with a science insight or question left for the viewer.`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, influencerId, animeStyle, durationS, lang } = await request.json()
  if (!content || !influencerId) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const { data: influencer } = await supabase
    .from('influencers')
    .select('id, name, slug, tagline, personality, domains, speaking_style, catchphrases, type')
    .eq('id', influencerId)
    .single()
  if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })

  const isZh = lang !== 'en'
  const validStyles = new Set(Object.keys(ANIME_STYLE_PROMPTS))
  const style = validStyles.has(animeStyle) ? animeStyle : 'modern'
  const styleDesc = ANIME_STYLE_PROMPTS[style]
  const clipCount = Math.max(2, Math.min(12, Math.floor(durationS / 15)))
  const clipDuration = Math.round(durationS / clipCount)

  const personality = Array.isArray(influencer.personality) ? (influencer.personality as string[]).join(', ') : ''
  const catchphrases = Array.isArray(influencer.catchphrases) ? (influencer.catchphrases as string[]) : []

  const characterDossier = isZh
    ? `## 动画角色设定
角色：${influencer.name}
性格：${personality || influencer.tagline}
说话风格：${influencer.speaking_style || '生动有趣，富有表现力'}
口头禅：${catchphrases.length ? catchphrases.map(c => `"${c}"`).join('、') : '无'}
动画视觉风格：${styleDesc}
台词要求：符合角色性格，每段不超过 ${isZh ? 25 : 15} 个字/词`
    : `## Animated Character Card
Character: ${influencer.name}
Personality: ${personality || influencer.tagline}
Speaking style: ${influencer.speaking_style || 'expressive, lively, and fun'}
Catchphrases: ${catchphrases.length ? catchphrases.map(c => `"${c}"`).join(', ') : 'none'}
Anime visual style: ${styleDesc}
Dialogue rule: match character personality, max ${isZh ? 25 : 15} words per clip`

  const storyArc = isZh ? STORY_ARC_ZH : STORY_ARC_EN

  const systemPrompt = isZh
    ? `你是动画科普故事编剧，擅长把复杂科学原理用角色故事演绎出来。
你的脚本要有戏剧张力，每个场景都要有画面冲击力，让观众在看故事的同时学到科学知识。
每段 shot_description 要极其详细，包含：景别、镜头运动、角色动作、场景色彩、特效。`
    : `You are an animated science story scriptwriter, expert at dramatizing complex science through character stories.
Your scripts must have dramatic tension, visual impact, and teach science through storytelling.
Each shot_description must be highly detailed: shot type, camera motion, character action, scene colors, special effects.`

  const userPrompt = isZh
    ? `${characterDossier}

---

${storyArc}

---

## 科学内容
标题：${content.title}
核心概念：${content.summary}
关键要点：
${(content.keyPoints as string[]).map((k, i) => `${i + 1}. ${k}`).join('\n')}

## 生成要求
- 共 ${clipCount} 个场景，每段 ${clipDuration} 秒
- 用故事化的方式演绎以上科学内容，不要直接说教
- shot_description 必须反映动漫视觉风格：${styleDesc}
- 台词要符合角色人设，自然对话

严格返回 JSON 数组（不含 markdown 代码块）：
[
  {
    "index": 0,
    "speaker": "${influencer.slug || influencer.name}",
    "dialogue": "角色台词（符合人设，${clipDuration}秒内）",
    "shot_description": "Detailed English scene description for Kling: shot type + camera motion + character action + scene color + anime style effects",
    "duration": ${clipDuration}
  }
]

生成恰好 ${clipCount} 个场景。`
    : `${characterDossier}

---

${storyArc}

---

## Science Content
Title: ${content.title}
Core concept: ${content.summary}
Key points:
${(content.keyPoints as string[]).map((k, i) => `${i + 1}. ${k}`).join('\n')}

## Requirements
- ${clipCount} scenes, each ${clipDuration} seconds
- Dramatize the science through story — no direct lecturing
- shot_description must reflect anime visual style: ${styleDesc}
- Dialogue must match character personality

Return strict JSON array (no markdown code blocks):
[
  {
    "index": 0,
    "speaker": "${influencer.slug || influencer.name}",
    "dialogue": "Character dialogue (in-character, fits in ${clipDuration}s)",
    "shot_description": "Detailed English scene description for Kling: shot type + camera motion + character action + scene color + anime style effects",
    "duration": ${clipDuration}
  }
]

Return exactly ${clipCount} scenes.`

  try {
    const script = await callGeminiJson<Record<string, unknown>[]>({ systemPrompt, userPrompt })
    if (!Array.isArray(script)) throw new Error('Expected array')
    return NextResponse.json({ script })
  } catch (err) {
    return NextResponse.json({ error: `生成失败: ${(err as Error).message}` }, { status: 500 })
  }
}
