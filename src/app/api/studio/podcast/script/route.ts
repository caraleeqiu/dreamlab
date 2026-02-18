import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ScriptClip, Influencer } from '@/types'
import { PLATFORMS } from '@/lib/language'

// POST /api/studio/podcast/script
// body: { topics, keypoints, perspective?, format, platform, duration_s, influencers, language }
// 返回：ScriptClip[]
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topics, keypoints, perspective, format, platform, duration_s, influencers, language } = await request.json()
  const isZh = language !== 'en'
  const clipCount = Math.floor(duration_s / 15)
  const isTwoHost = format === 'dialogue' && influencers.length === 2

  const infA: Influencer = influencers[0]
  const infB: Influencer = influencers[1]

  const shotLib = [
    'Close-up shot, talking head facing camera, studio background with soft bokeh',
    'Medium shot, host gesturing expressively, dynamic lighting',
    'Over-the-shoulder shot, both hosts visible, one reacting while other speaks',
    'Wide shot, both hosts at podcast desk, professional setup',
    'Dramatic close-up, intense eye contact with camera',
  ]

  const systemPrompt = isZh
    ? `你是专业播客脚本作家。请根据话题和要点，为指定网红生成完整的分镜脚本。
每个切片15秒，台词自然流畅，符合网红人设。
${isTwoHost ? `主持人A（${infA.name}）：${infA.speaking_style || infA.tagline}
主持人B（${infB.name}）：${infB.speaking_style || infB.tagline}` : `主持人（${infA.name}）：${infA.speaking_style || infA.tagline}`}`
    : `You are a professional podcast scriptwriter. Generate a complete script with shot descriptions for the given influencer(s).
Each clip is 15 seconds. Dialogue should feel natural and match the influencer's personality.
${isTwoHost ? `Host A (${infA.name}): ${infA.speaking_style || infA.tagline}
Host B (${infB.name}): ${infB.speaking_style || infB.tagline}` : `Host (${infA.name}): ${infA.speaking_style || infA.tagline}`}`

  const userPrompt = isZh
    ? `话题：${topics.map((t: {title: string}) => t.title).join(' × ')}
${perspective ? `本期视角：${perspective}` : ''}
核心要点：
${keypoints.map((k: string, i: number) => `${i + 1}. ${k}`).join('\n')}

请生成 ${clipCount} 个15秒切片的完整脚本。
${isTwoHost ? `采用对谈形式，A和B轮流发言，有互动。` : '单口形式。'}

严格返回 JSON 数组格式，每个元素包含：
{
  "index": 数字（从0开始）,
  "speaker": "${infA.slug}"${isTwoHost ? ` 或 "${infB.slug}"` : ''},
  "dialogue": "台词文本（15秒内自然说完）",
  "shot_description": "英文镜头描述（供 Kling 生成用）",
  "shot_type": "景别，从 特写/近景/中景/全景/俯拍/仰拍 中选一个",
  "camera_movement": "镜头运动，从 固定/推进/拉远/摇镜/跟拍 中选一个",
  "bgm": "BGM风格，从 轻松欢快/科技感/励志/悬疑/温馨/紧张 中选一个",
  "voiceover": "旁白（如无则为空字符串）",
  "duration": 15
}`
    : `Topics: ${topics.map((t: {title: string}) => t.title).join(' × ')}
${perspective ? `Episode Angle: ${perspective}` : ''}
Key Points:
${keypoints.map((k: string, i: number) => `${i + 1}. ${k}`).join('\n')}

Generate ${clipCount} clips of 15 seconds each.
${isTwoHost ? 'Dialogue format, A and B alternating with natural interaction.' : 'Solo format.'}

Return strict JSON array, each element:
{
  "index": number (0-based),
  "speaker": "${infA.slug}"${isTwoHost ? ` or "${infB.slug}"` : ''},
  "dialogue": "spoken text (fits naturally in 15 seconds)",
  "shot_description": "cinematic shot description for Kling video generation",
  "shot_type": "one of: 特写/近景/中景/全景/俯拍/仰拍",
  "camera_movement": "one of: 固定/推进/拉远/摇镜/跟拍",
  "bgm": "one of: 轻松欢快/科技感/励志/悬疑/温馨/紧张",
  "voiceover": "voiceover text if any, else empty string",
  "duration": 15
}`

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return NextResponse.json({ error: 'AI 脚本生成失败' }, { status: 500 })

  try {
    const clips: ScriptClip[] = JSON.parse(text)
    return NextResponse.json(clips)
  } catch {
    return NextResponse.json({ error: '脚本解析失败', raw: text }, { status: 500 })
  }
}
