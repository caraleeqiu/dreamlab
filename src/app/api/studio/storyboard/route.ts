import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ScriptClip, Influencer } from '@/types'

// POST /api/studio/storyboard
// body: { content, influencers, platform, duration_s, lang, job_type }
// 返回：{ script: ScriptClip[] }（含完整分镜字段）
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, influencers, platform, duration_s, lang, job_type } = await request.json()
  const isZh = lang !== 'en'
  const clipCount = Math.floor((duration_s || 180) / 15)
  const infList: Influencer[] = influencers || []

  const slugList = infList.map(i => i.slug).join(', ')

  const systemPrompt = isZh
    ? `你是专业分镜导演。根据提供的内容，为AI视频生成完整分镜脚本。
每个切片15秒。台词自然，符合网红人设。
可用主持人：${infList.map(i => `${i.slug}（${i.name}，${i.tagline}）`).join('；')}`
    : `You are a professional storyboard director. Generate a complete storyboard script for AI video generation.
Each clip is 15 seconds. Dialogue should feel natural and match the influencer's personality.
Available hosts: ${infList.map(i => `${i.slug} (${i.name}, ${i.tagline})`).join('; ')}`

  const userPrompt = isZh
    ? `内容：
${content}

平台：${platform}，时长：${duration_s}秒，类型：${job_type}

请生成 ${clipCount} 个切片的分镜脚本。
严格返回 JSON 数组，每个元素：
{
  "index": 数字（从0开始）,
  "speaker": "${slugList.split(', ')[0]}"${infList.length > 1 ? ` 或 "${slugList.split(', ')[1] || ''}"` : ''},
  "dialogue": "台词（15秒内说完）",
  "shot_description": "英文电影级镜头描述，格式：[景别]+[运镜]+[主体动作]+[场景环境]+[光影色调]。例：'Medium close-up, slow dolly in, host speaking to camera, warm studio bokeh'",
  "shot_type": "景别，从以下选一个：极特写/特写/中近景/中景/中远景/全景/大远景/俯拍/仰拍/鸟瞰/过肩/第一视角",
  "camera_movement": "运镜，从以下选一个：固定/慢推/急推/拉远/左摇/右摇/上摇/下摇/横移/环绕/跟随/上升/下降/左旋推进/右旋推进/变焦/手持",
  "bgm": "BGM风格，从 轻松欢快/科技感/励志/悬疑/温馨/紧张 中选一个",
  "voiceover": "旁白（如无则为空字符串）",
  "duration": 15
}`
    : `Content:
${content}

Platform: ${platform}, Duration: ${duration_s}s, Type: ${job_type}

Generate ${clipCount} clips for the storyboard.
Return strict JSON array, each element:
{
  "index": number (0-based),
  "speaker": "${slugList.split(', ')[0]}"${infList.length > 1 ? ` or "${slugList.split(', ')[1] || ''}"` : ''},
  "dialogue": "spoken text (fits naturally in 15 seconds)",
  "shot_description": "cinematic description — format: [shot type] + [camera move] + [subject action] + [scene] + [lighting/tone]. E.g. 'Medium close-up, slow dolly in, host speaking naturally to camera, warm studio bokeh'",
  "shot_type": "one of: 极特写/特写/中近景/中景/中远景/全景/大远景/俯拍/仰拍/鸟瞰/过肩/第一视角",
  "camera_movement": "one of: 固定/慢推/急推/拉远/左摇/右摇/上摇/下摇/横移/环绕/跟随/上升/下降/左旋推进/右旋推进/变焦/手持",
  "bgm": "one of: 轻松欢快/科技感/励志/悬疑/温馨/紧张",
  "voiceover": "voiceover text if any, else empty string",
  "duration": 15
}`

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_API_KEY,
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

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return NextResponse.json({ error: '分镜生成失败' }, { status: 500 })

  try {
    const script: ScriptClip[] = JSON.parse(text)
    return NextResponse.json({ script })
  } catch {
    return NextResponse.json({ error: '分镜解析失败', raw: text }, { status: 500 })
  }
}
