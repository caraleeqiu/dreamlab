import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Influencer } from '@/types'

const GENRE_PROMPT: Record<string, string> = {
  romance:   '爱情故事，细腻情感，真实动人',
  comedy:    '喜剧情景，幽默反转，欢乐轻松',
  suspense:  '悬疑叙事，层层递进，扣人心弦',
  fantasy:   '奇幻世界，想象丰富，视觉震撼',
  adventure: '冒险历程，刺激紧张，勇敢探索',
  horror:    '恐怖氛围，心理张力，惊悚结尾',
}

const STYLE_PROMPT: Record<string, string> = {
  skit:      '短小精悍的情景喜剧风格，夸张表情，快节奏',
  cinematic: '电影感镜头语言，精心构图，缓慢推进情感',
  vlog:      '第一人称Vlog风格，直接对镜头说话，真实感强',
  manga:     '参考漫画分镜的夸张视觉效果，大幅度动作',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storyTitle, storyIdea, genre, narrativeStyle, influencers, durationS, lang } = await req.json()

  const castDesc = (influencers as Influencer[]).map((inf, i) =>
    `角色${i + 1}（演员：${inf.name}）：${inf.tagline}，性格：${inf.personality?.join('、') || '多样'}`
  ).join('\n')

  const langNote = lang === 'en' ? 'Write all dialogue in English.' : '所有台词用中文写。'
  const genreDesc = GENRE_PROMPT[genre] || '创意故事'
  const styleDesc = STYLE_PROMPT[narrativeStyle] || '电影感叙事'

  const clipCount = Math.max(3, Math.min(8, Math.ceil(durationS / 15)))

  const prompt = `你是一位顶级短视频导演兼编剧，专注于${genreDesc}。
${langNote}

【故事信息】
标题：${storyTitle || '（未命名）'}
创意：${storyIdea}
类型：${genreDesc}
叙事风格：${styleDesc}
总时长：约${durationS}秒
场景数：${clipCount}个

【演员阵容】
${castDesc}

【任务】
为上述故事创作一个${clipCount}幕短剧脚本。
- 每幕15秒以内
- 场景描述要具体（拍摄角度、光线、环境、演员动作）
- 台词要符合角色性格，自然流畅
- 故事要有起承转合，有情感张力
- speaker字段填演员的slug（如没有对话可留空字符串）

以JSON数组返回：
[
  {
    "index": 0,
    "speaker": "influencer-slug或空字符串",
    "dialogue": "角色台词（无旁白时为空字符串）",
    "shot_description": "详细场景描述：拍摄方式、环境、演员表情动作",
    "duration": 10
  }
]`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 1.0 },
        }),
      }
    )
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const script = JSON.parse(text)
    return NextResponse.json({ script })
  } catch (e: unknown) {
    console.error('Story script error:', e)
    return NextResponse.json({ error: 'Script generation failed' }, { status: 500 })
  }
}
