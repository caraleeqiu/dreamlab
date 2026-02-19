import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGeminiJson } from '@/lib/gemini'
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

// Platform-specific style guidance
const PLATFORM_STYLE: Record<string, string> = {
  tiktok:    '平台：TikTok。风格：超快节奏，每句话必须制造悬念或冲突，口语化极强，禁止任何自我介绍开场，第一秒必须抓人。',
  xiaohongshu: '平台：小红书。风格：真实分享感，口吻像朋友间的对话，充满细节和个人经验，适当使用感叹词和表情语气，结尾鼓励互动。',
  bilibili:  '平台：B站。风格：信息密度高，有一定深度，可以有幽默和二次元梗，粉丝粘性强，结尾可适当硬核总结。',
  youtube:   '平台：YouTube。风格：结构清晰，开场10秒明确告诉观众本视频的价值，中间详细展开，结尾有CTA（订阅/点赞）。',
  instagram: '平台：Instagram Reels。风格：视觉驱动，台词简洁有力，每5秒一个新信息点，强调情绪感染力。',
  douyin:    '平台：抖音。风格：极强的情绪张力，第一句话必须触发强烈情绪（好奇/共鸣/震惊），节奏快，口语化。',
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
  const platformStyle = PLATFORM_STYLE[platform] || ''

  const infA: Influencer = influencers[0]
  const infB: Influencer = influencers[1]

  const shotLib = [
    'Close-up shot, talking head facing camera, soft studio bokeh with gentle background motion',
    'Medium shot, host gesturing expressively, dynamic rim lighting',
    'Over-the-shoulder shot, both hosts visible, one reacting while other speaks',
    'Wide shot, both hosts at podcast desk, professional setup with subtle background activity',
    'Dramatic close-up, intense eye contact with camera, slight lean forward',
  ]

  const viralStructure = isZh
    ? `【爆款结构要求】
- Hook（第1-2片）：开场必须制造强烈悬念/冲突/反直觉信息，让观众无法中途退出
- Build（中间片段）：每5秒一个新信息点，保持信息密度，避免废话和重复
- Payoff（最后1-2片）：情绪落点——感动/共鸣/震惊/笑声，或悬念引导下集/关注`
    : `[Viral Structure Requirements]
- Hook (clips 1-2): Opening must create strong suspense/conflict/counterintuitive info — no self-introductions
- Build (middle clips): New information point every 5 seconds, high density, no filler
- Payoff (last 1-2 clips): Emotional landing — resonance/shock/laughter, or cliffhanger for next episode`

  const systemPrompt = isZh
    ? `你是专业播客脚本作家，深谙爆款短视频结构。请根据话题和要点，为指定网红生成完整的分镜脚本。
每个切片5秒，台词自然流畅，符合网红人设。
${platformStyle}
${hookDesc}
${isTwoHost ? `主持人A（${infA.name}）：${infA.speaking_style || infA.tagline}
主持人B（${infB.name}）：${infB.speaking_style || infB.tagline}` : `主持人（${infA.name}）：${infA.speaking_style || infA.tagline}`}`
    : `You are a professional podcast scriptwriter who understands viral short-form video structure. Generate a complete script with shot descriptions for the given influencer(s).
Each clip is 5 seconds. Dialogue should feel natural and match the influencer's personality.
${platformStyle}
${hookDesc}
${isTwoHost ? `Host A (${infA.name}): ${infA.speaking_style || infA.tagline}
Host B (${infB.name}): ${infB.speaking_style || infB.tagline}` : `Host (${infA.name}): ${infA.speaking_style || infA.tagline}`}`

  const userPrompt = isZh
    ? `话题：${topics.map((t: {title: string}) => t.title).join(' × ')}
${perspective ? `本期视角：${perspective}` : ''}
核心要点：
${keypoints.map((k: string, i: number) => `${i + 1}. ${k}`).join('\n')}

${viralStructure}

请生成 ${clipCount} 个15秒切片的完整脚本。
${isTwoHost ? `采用对谈形式，A和B轮流发言，有互动。` : '单口形式。'}

严格返回 JSON 数组格式，每个元素包含：
{
  "index": 数字（从0开始）,
  "speaker": "${infA.slug}"${isTwoHost ? ` 或 "${infB.slug}"` : ''},
  "dialogue": "台词文本（15秒内自然说完，约100-150字）",
  "shot_description": "英文电影级镜头描述，格式：[景别] + [运镜] + [主体动作和微动作] + [场景环境] + [光影色调]。要包含微动作引导：natural micro-movements, subtle gestures, realistic breathing, gentle background motion。例：'Medium close-up, slow dolly in, host speaking with natural hand gestures and slight lean forward, soft bokeh studio with plants in background gently swaying, warm 3-point lighting from camera-left'",
  "shot_type": "景别，从以下选一个：极特写/特写/中近景/中景/中远景/全景/大远景/俯拍/仰拍/鸟瞰/过肩/第一视角",
  "camera_movement": "运镜，从以下选一个：固定/慢推/急推/拉远/左摇/右摇/上摇/下摇/横移/环绕/跟随/上升/下降/左旋推进/右旋推进/变焦/手持",
  "bgm": "BGM风格，从 轻松欢快/科技感/励志/悬疑/温馨/紧张 中选一个",
  "voiceover": "旁白（如无则为空字符串）",
  "consistency_anchor": "一句话场景锚定，格式：[主持人外观]+[场景/地点]+[光线/时间]。同场景多个切片必须使用完全相同的描述以确保视觉一致性。例：'Alex穿深蓝polo衫，现代播客录音室，白色柔光箱，暖黄背景灯'",
  "duration": 15
}`
    : `Topics: ${topics.map((t: {title: string}) => t.title).join(' × ')}
${perspective ? `Episode Angle: ${perspective}` : ''}
Key Points:
${keypoints.map((k: string, i: number) => `${i + 1}. ${k}`).join('\n')}

${viralStructure}

Generate ${clipCount} clips of 5 seconds each.
${isTwoHost ? 'Dialogue format, A and B alternating with natural interaction.' : 'Solo format.'}

Return strict JSON array, each element:
{
  "index": number (0-based),
  "speaker": "${infA.slug}"${isTwoHost ? ` or "${infB.slug}"` : ''},
  "dialogue": "spoken text (fits naturally in 15 seconds, ~80-120 words)",
  "shot_description": "cinematic description — [shot type] + [camera move] + [subject action with micro-movements] + [scene/environment] + [lighting/tone]. Must include: natural micro-movements, subtle gestures, realistic breathing, gentle background motion. E.g. 'Medium close-up, slow dolly in, host speaking with natural hand gestures and slight lean forward, soft bokeh studio with background lights and subtle plant movement, warm 3-point lighting key-left'",
  "shot_type": "one of: 极特写/特写/中近景/中景/中远景/全景/大远景/俯拍/仰拍/鸟瞰/过肩/第一视角",
  "camera_movement": "one of: 固定/慢推/急推/拉远/左摇/右摇/上摇/下摇/横移/环绕/跟随/上升/下降/左旋推进/右旋推进/变焦/手持",
  "bgm": "one of: 轻松欢快/科技感/励志/悬疑/温馨/紧张",
  "voiceover": "voiceover text if any, else empty string",
  "consistency_anchor": "One-sentence scene lock: [host appearance]+[location]+[lighting]. Clips in the same location MUST share identical anchor text. E.g. 'Alex in dark blue polo, modern podcast studio, white softbox, warm amber background'",
  "duration": 15
}`

  try {
    const clips = await callGeminiJson<ScriptClip[]>({ systemPrompt, userPrompt })
    return NextResponse.json(clips)
  } catch (err) {
    return NextResponse.json({ error: `脚本生成失败: ${(err as Error).message}` }, { status: 500 })
  }
}
