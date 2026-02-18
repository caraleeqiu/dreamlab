import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Auto anime style → visual description (no longer chosen by user)
const ANIME_STYLE_PROMPTS: Record<string, string> = {
  cyberpunk: 'Cyberpunk aesthetic, neon lighting, futuristic city, high-tech feel',
  ancient:   'Chinese ancient style, ink-wash painting aesthetic, classical elegance',
  modern:    'Modern urban setting, fashion-forward, lifestyle scenes',
  cute:      'Chibi anime style, kawaii, pastel colors, expressive eyes',
  fantasy:   'Fantasy magic world, epic scale, colorful particle effects',
  minimal:   'Minimalist, clean backgrounds, premium feel',
}

// Format → structural guidance
const FORMAT_GUIDANCE: Record<string, { hook: string; arc: string }> = {
  voiceover: {
    hook: 'Character addresses camera directly — bold statement or question that creates instant relatability.',
    arc:  'Hook → Problem/Insight → Product as the answer → Character endorsement (1-2 sentence payoff)',
  },
  drama: {
    hook: 'Drop into conflict in medias res — no setup, no names. Force the question "what happens next?"',
    arc:  'Hook (conflict peak) → Escalation (antagonist pushes, protagonist resists) → Reversal (product as catalyst) → Release (爽点 delivered fast)',
  },
  other: {
    hook: 'Atmosphere-first: an iconic visual moment that captures the brand vibe.',
    arc:  'Vibe establishing → Product integration (organic) → Emotional payoff',
  },
}

// Build a character dossier from influencer data (OOC prevention)
function buildCharacterDossier(influencer: Record<string, unknown>, lang: string): string {
  const isZh = lang !== 'en'
  const name = influencer.name as string
  const tagline = influencer.tagline as string || ''
  const personality = (influencer.personality as string[])?.join(', ') || ''
  const speakingStyle = influencer.speaking_style as string || ''
  const catchphrases = (influencer.catchphrases as string[]) || []
  const domains = (influencer.domains as string[])?.join(', ') || ''
  const type = influencer.type as string || 'virtual'

  if (isZh) {
    return `## 角色设定卡（OOC防护层）
角色名：${name}
性格标签：${personality || '未知'}
人物简介：${tagline}
擅长领域：${domains}
说话风格：${speakingStyle || '自然流畅'}
口头禅 / 标志性台词：${catchphrases.length ? catchphrases.map(c => `"${c}"`).join('、') : '（无特定口头禅）'}
角色类型：${type}

【角色行为约束】
- 台词必须符合以上说话风格，不能说出完全不像该角色的话
- 口头禅可自然植入台词中增加真实感
- 禁止让角色说出违背其性格的内容（如：一个冷酷角色不应突然变得滥情）
- 角色的态度和语气要始终一致`
  } else {
    return `## Character Dossier (OOC Guard Layer)
Character: ${name}
Personality: ${personality || 'unknown'}
Tagline: ${tagline}
Domains: ${domains}
Speaking style: ${speakingStyle || 'natural and fluid'}
Signature phrases: ${catchphrases.length ? catchphrases.map(c => `"${c}"`).join(', ') : '(none defined)'}
Type: ${type}

[Character Behavior Constraints]
- Dialogue must match the speaking style above — never out of character
- Catchphrases may be naturally woven into dialogue for authenticity
- Never have the character say anything that contradicts their core personality
- Maintain consistent tone and attitude throughout`
  }
}

// Duration label for clarity in prompts
function durationLabel(totalDuration: string, clipCount: number, lang: string): string {
  const isZh = lang !== 'en'
  if (isZh) return `总时长 ${totalDuration}，共 ${clipCount} 个场景`
  return `Total duration ${totalDuration}, ${clipCount} scenes`
}

// Sanitize user text: strip control chars + truncate to max length
function sanitize(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return ''
  // Strip ASCII control chars (except newline) and potential prompt-injection markers
  return value.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '').slice(0, maxLen)
}

// Allowed enum values — reject anything unexpected
const VALID_FORMATS = new Set(['voiceover', 'drama', 'other'])
const VALID_DURATIONS = new Set(['15s', '30s', '60s', '3min'])
const VALID_CATEGORIES = new Set(['eat', 'wear', 'play', 'use'])
const VALID_STYLES = new Set(['cyberpunk', 'ancient', 'modern', 'cute', 'fantasy', 'minimal'])

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // ── Sanitize and validate all user-supplied inputs ──
  const brandName     = sanitize(body.brandName, 80)
  const productName   = sanitize(body.productName, 80)
  const productDesc   = sanitize(body.productDesc, 300)
  const targetAudience = sanitize(body.targetAudience, 100)
  const lang          = body.lang === 'en' ? 'en' : 'zh'

  // Enum validation — default to safe values if unexpected
  const videoFormat    = VALID_FORMATS.has(body.videoFormat) ? body.videoFormat as string : 'voiceover'
  const totalDuration  = VALID_DURATIONS.has(body.totalDuration) ? body.totalDuration as string : '30s'
  const productCategory = VALID_CATEGORIES.has(body.productCategory) ? body.productCategory as string : 'use'
  const animeStyle     = VALID_STYLES.has(body.animeStyle) ? body.animeStyle as string : 'modern'

  // clipCount must be a positive integer, max 12
  const clipCount = Math.max(1, Math.min(12, Math.floor(Number(body.clipCount) || 2)))

  // ── Fetch influencer from DB (don't trust client-supplied influencer data) ──
  const influencerId = body.influencerId
  if (!influencerId) return NextResponse.json({ error: 'influencerId required' }, { status: 400 })

  const { data: influencer } = await supabase
    .from('influencers')
    .select('id, name, slug, tagline, personality, domains, speaking_style, catchphrases, type')
    .eq('id', influencerId)
    .single()

  if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })

  // Require minimum product info to proceed
  if (!brandName.trim() || !productName.trim()) {
    return NextResponse.json({ error: 'brandName and productName are required' }, { status: 400 })
  }

  const isZh = lang !== 'en'
  const styleDesc = ANIME_STYLE_PROMPTS[animeStyle] || 'anime style'
  const formatGuide = FORMAT_GUIDANCE[videoFormat as string] || FORMAT_GUIDANCE.other
  const characterDossier = buildCharacterDossier(influencer as Record<string, unknown>, lang)
  const durationNote = durationLabel(totalDuration, clipCount, lang)
  const clipDurationSec = Math.round(
    (totalDuration === '15s' ? 15 : totalDuration === '30s' ? 30 : totalDuration === '60s' ? 60 : 180) / clipCount
  )

  // Category → scene flavor
  const categoryFlavor: Record<string, string> = isZh
    ? { eat: '食物场景：美食特写、香气感、食欲感', wear: '时尚场景：穿搭展示、质感光线、品味氛围', play: '探索场景：沉浸感、好奇心、发现惊喜', use: '效率场景：解决问题、工具感、成就满足' }
    : { eat: 'Food scenes: close-up detail, appetite appeal, aroma feeling', wear: 'Fashion scenes: outfit reveal, quality lighting, taste atmosphere', play: 'Discovery scenes: immersion, curiosity, moment of surprise', use: 'Productivity scenes: problem-solving, tool-feel, achievement satisfaction' }
  const sceneFlavor = categoryFlavor[productCategory as string] || (isZh ? '生活场景' : 'Lifestyle scenes')

  const systemPrompt = isZh
    ? `你是专业的动漫营销短片编剧，精通中国漫剧叙事结构（Hook→冲突→反转→爽点）和动漫视觉语言。
你创作的每段脚本都必须让角色的台词符合其人设，绝对不能OOC（Out of Character）。`
    : `You are a professional anime marketing scriptwriter, expert in short-form anime drama structure (Hook→Conflict→Reversal→Payoff) and anime visual language.
Every script you write must keep character dialogue strictly in-character. OOC (Out of Character) is forbidden.`

  const userPrompt = isZh
    ? `${characterDossier}

---

## 任务：创作动漫营销视频脚本

品牌：${brandName}
产品：${productName}
卖点：${productDesc || '（用户未提供，请根据产品名合理推断）'}
目标受众：${targetAudience || '年轻用户'}
代言角色：${influencer.name}
视频格式：${videoFormat === 'voiceover' ? '口播类' : videoFormat === 'drama' ? '剧情类' : '其他创意类'}
产品类别：${sceneFlavor}
动漫视觉风格：${styleDesc}
${durationNote}，每段约 ${clipDurationSec} 秒

## 叙事结构要求
开场钩子：${formatGuide.hook}
整体弧线：${formatGuide.arc}

## 脚本格式规则
- 每段台词不超过 30 字（字幕节奏）
- 每段 shot_description 包含：景别（特写/近景/中景/全景）、镜头运动、角色动作、场景色调
- 如果格式是口播类或剧情类，角色必须有对话；其他类可以不说话但需要有强烈视觉
- 第一个场景必须是钩子/开场
- 最后一个场景必须有产品植入 + 情绪收口
- 【内心独白提示】在生成台词前，先在脑海中模拟角色的真实感受（不要输出到JSON，只用于指导台词质量）

以JSON数组格式返回，不要有markdown代码块：
[
  {
    "index": 0,
    "speaker": "${influencer.slug || influencer.name}",
    "dialogue": "角色台词（口播类/剧情类必填；其他类可为空字符串）",
    "shot_description": "详细场景描述（景别+动作+色调+特效，方便AI视频生成）",
    "duration": ${clipDurationSec}
  }
]

严格返回 ${clipCount} 个场景。`
    : `${characterDossier}

---

## Task: Write Anime Marketing Video Script

Brand: ${brandName}
Product: ${productName}
Selling points: ${productDesc || '(not provided — infer reasonably from product name)'}
Target audience: ${targetAudience || 'Young users'}
Character: ${influencer.name}
Video format: ${videoFormat === 'voiceover' ? 'Voiceover' : videoFormat === 'drama' ? 'Drama/Skit' : 'Other/Creative'}
Product category: ${sceneFlavor}
Anime visual style: ${styleDesc}
${durationNote}, each scene ~${clipDurationSec}s

## Narrative Structure
Opening hook: ${formatGuide.hook}
Overall arc: ${formatGuide.arc}

## Script Format Rules
- Dialogue: max 15 words per line (subtitle pacing)
- shot_description must include: shot type (ECU/CU/MS/LS), camera motion, character action, scene tone
- Voiceover/drama format: character must have dialogue; other format can be silent but needs strong visual
- Scene 1 must be the hook/opening
- Final scene must have product integration + emotional close
- [Inner monologue tip] Before writing each line, mentally simulate the character's true feeling (don't output this — use it to guide dialogue authenticity)

Return as JSON array, no markdown code blocks:
[
  {
    "index": 0,
    "speaker": "${influencer.slug || influencer.name}",
    "dialogue": "Character line (required for voiceover/drama; empty string OK for other)",
    "shot_description": "Detailed scene description (shot type + action + tone + effects, for AI video generation)",
    "duration": ${clipDurationSec}
  }
]

Return exactly ${clipCount} scenes.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.85,
            // Enough tokens for 12-clip scripts
            maxOutputTokens: 4096,
          },
        }),
      }
    )
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      console.error('Anime script: no text from Gemini', JSON.stringify(data))
      return NextResponse.json({ error: 'Script generation failed' }, { status: 500 })
    }
    const script = JSON.parse(text)
    if (!Array.isArray(script)) throw new Error('Expected array from Gemini')
    return NextResponse.json({ script })
  } catch (e: unknown) {
    console.error('Anime script error:', e)
    return NextResponse.json({ error: 'Script generation failed' }, { status: 500 })
  }
}
