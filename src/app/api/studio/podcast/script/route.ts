import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ScriptClip, Influencer } from '@/types'
import { PLATFORMS } from '@/lib/language'

// Podcast-specific opening hooks — conversational/info format, not narrative drama
const HOOK_PROMPT: Record<string, string> = {
  bold_claim:  '【开场钩子：大胆结论】第一片用最核心、最反直觉的结论开场，直接说出听众平时不敢相信的事实或观点。不需要铺垫，直接抛出：观众必须先接受这个冲击，才想知道为什么。',
  question:    '【开场钩子：精准发问】第一片以一个精准击中目标用户痛点的问题开场。问题必须让听众觉得"这说的就是我"，让他们立刻产生"我需要听下去"的强烈欲望。',
  story:       '【开场钩子：故事导入】第一片以一个真实的、具体的事件或亲身经历开场。场景要够细节，让听众立刻代入，然后在第一片结尾揭示"这件事和我们今天要聊的主题直接相关"。',
  stat:        '【开场钩子：数据冲击】第一片以一个听众绝对没想到的数据或事实开场。数据必须反直觉，越出乎意料越好。然后紧接着说："这意味着什么？今天我们就来聊这件事。"',
  contrast:    '【开场钩子：反转认知】第一片以"大多数人以为……但其实……"的结构开场。先承认一个被广泛接受的常识，然后用一句话把它颠覆，制造认知落差，吸引听众主动寻找答案。',
}

// POST /api/studio/podcast/script
// body: { topics, keypoints, perspective?, format, platform, duration_s, influencers, language }
// 返回：ScriptClip[]
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topics, keypoints, perspective, format, platform, duration_s, influencers, language, hookType } = await request.json()
  const isZh = language !== 'en'
  const hookDesc = HOOK_PROMPT[hookType as string] || HOOK_PROMPT['bold_claim']
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
${hookDesc}
${isTwoHost ? `主持人A（${infA.name}）：${infA.speaking_style || infA.tagline}
主持人B（${infB.name}）：${infB.speaking_style || infB.tagline}` : `主持人（${infA.name}）：${infA.speaking_style || infA.tagline}`}`
    : `You are a professional podcast scriptwriter. Generate a complete script with shot descriptions for the given influencer(s).
Each clip is 15 seconds. Dialogue should feel natural and match the influencer's personality.
${hookDesc}
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
  "shot_description": "英文电影级镜头描述，格式：[景别] + [运镜] + [主体动作] + [场景环境] + [光影色调]。例：'Medium close-up, slow dolly in, host speaking to camera with natural gesture, modern studio, warm bokeh lighting'",
  "shot_type": "景别，从以下选一个：极特写/特写/中近景/中景/中远景/全景/大远景/俯拍/仰拍/鸟瞰/过肩/第一视角",
  "camera_movement": "运镜，从以下选一个：固定/慢推/急推/拉远/左摇/右摇/上摇/下摇/横移/环绕/跟随/上升/下降/左旋推进/右旋推进/变焦/手持",
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
  "shot_description": "cinematic description — format: [shot type] + [camera move] + [subject action] + [scene/environment] + [lighting/tone]. E.g. 'Medium close-up, slow dolly in, host gesturing naturally to camera, modern studio, warm bokeh'",
  "shot_type": "one of: 极特写/特写/中近景/中景/中远景/全景/大远景/俯拍/仰拍/鸟瞰/过肩/第一视角",
  "camera_movement": "one of: 固定/慢推/急推/拉远/左摇/右摇/上摇/下摇/横移/环绕/跟随/上升/下降/左旋推进/右旋推进/变焦/手持",
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
