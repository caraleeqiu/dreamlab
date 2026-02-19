import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Influencer } from '@/types'

const HOOK_PROMPT: Record<string, string> = {
  midaction:  '【开场钩子：开场即危机】第一幕必须从事件最紧张的瞬间切入，无任何铺垫。角色已经在对某件令人震惊的事情做出反应，观众直接进入最高张力时刻。',
  curiosity:  '【开场钩子：好奇缺口】第一幕暗示一件异常的事情，但绝不说破它是什么。用一句话或一个画面制造"这是什么意思？"的疑问，迫使观众继续看下去。',
  confession: '【开场钩子：第一人称忏悔】第一幕由主角直视镜头说出："我从来没有告诉过任何人这件事……直到现在。"或类似的忏悔式开场白，承诺即将揭露一个秘密。',
  visual:     '【开场钩子：视觉悬疑物】第一幕以一个不该出现在这里的物体特写开场——没有对话，没有解释，只有这个物体和它带来的疑问。台词在第二幕才出现。',
  silence:    '【开场钩子：静默冲击】第一幕几乎全程无对话，用环境声和视觉张力建立极度压抑的沉默感。然后在第一幕结束时，一个声音或一句话打破一切，作为整个短剧的导火索。',
}

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

  const { storyTitle, storyIdea, genre, narrativeStyle, hookType, influencers, durationS, lang } = await req.json()

  const castDesc = (influencers as Influencer[]).map((inf, i) =>
    `角色${i + 1}（演员：${inf.name}）：${inf.tagline}，性格：${inf.personality?.join('、') || '多样'}`
  ).join('\n')

  const langNote = lang === 'en' ? 'Write all dialogue in English.' : '所有台词用中文写。'
  const genreDesc = GENRE_PROMPT[genre] || '创意故事'
  const styleDesc = STYLE_PROMPT[narrativeStyle] || '电影感叙事'
  const hookDesc  = HOOK_PROMPT[hookType] || HOOK_PROMPT['midaction']

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

${hookDesc}

- 每幕15秒以内
- shot_description 格式：[景别] + [运镜] + [主体动作] + [场景环境] + [光影色调]
  例："Medium shot, slow dolly in, character turning around with shocked expression, dimly lit alley, cold blue moonlight"
- shot_type 从以下选一个：极特写/特写/中近景/中景/中远景/全景/大远景/俯拍/仰拍/鸟瞰/过肩/第一视角
- camera_movement 从以下选一个：固定/慢推/急推/拉远/左摇/右摇/上摇/下摇/横移/环绕/跟随/上升/下降/左旋推进/右旋推进/变焦/手持
- 台词要符合角色性格，自然流畅
- 故事要有起承转合，有情感张力
- speaker字段填演员的slug（如没有对话可留空字符串）

以JSON数组返回：
[
  {
    "index": 0,
    "speaker": "influencer-slug或空字符串",
    "dialogue": "角色台词（无旁白时为空字符串）",
    "shot_description": "场景描述：[景别]+[运镜]+[主体动作]+[场景环境]+[光影色调]",
    "shot_type": "景别，从 极特写/特写/中近景/中景/中远景/全景/大远景/俯拍/仰拍/鸟瞰/过肩/第一视角 中选一个",
    "camera_movement": "运镜，从 固定/慢推/急推/拉远/左摇/右摇/上摇/下摇/横移/环绕/跟随/上升/下降/左旋推进/右旋推进/变焦/手持 中选一个",
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
