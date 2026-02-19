import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Influencer } from '@/types'
import { callGeminiJson } from '@/lib/gemini'

const HOOK_PROMPT: Record<string, string> = {
  midaction:  '【开场钩子：开场即危机】第一幕必须从事件最紧张的瞬间切入，无任何铺垫。角色已经在对某件令人震惊的事情做出反应，观众直接进入最高张力时刻。',
  curiosity:  '【开场钩子：好奇缺口】第一幕暗示一件异常的事情，但绝不说破它是什么。用一句话或一个画面制造"这是什么意思？"的疑问，迫使观众继续看下去。',
  confession: '【开场钩子：第一人称忏悔】第一幕由主角直视镜头说出："我从来没有告诉过任何人这件事……直到现在。"或类似的忏悔式开场白，承诺即将揭露一个秘密。',
  visual:     '【开场钩子：视觉悬疑物】第一幕以一个不该出现在这里的物体特写开场——没有对话，没有解释，只有这个物体和它带来的疑问。台词在第二幕才出现。',
  silence:    '【开场钩子：静默冲击】第一幕几乎全程无对话，用环境声和视觉张力建立极度压抑的沉默感。然后在第一幕结束时，一个声音或一句话打破一切，作为整个短剧的导火索。',
}

const SUBGENRE_PROMPT: Record<string, string> = {
  highway:       '【悬疑子类型：公路灵异】故事必须发生在公路/高速/荒野驾驶场景中。核心元素可选用：路肩上步行的异常人物（姿势不自然、直视司机）、幽灵搭车者（上车后消失）、CB电台收到不明声音、深夜路上遇到不明生物。强调孤立无援的绝望感——距最近城镇数十英里，无法停车。',
  psychological: '【悬疑子类型：心理悬疑】聚焦人物内心崩塌。元素可选：发现信任的人一直在撒谎、记忆与现实出现矛盾（我确定我做过这件事，但证据说没有）、自己的身份开始动摇。每一幕都应让观众质疑：主角的判断可靠吗？',
  truecrime:     '【悬疑子类型：真实犯罪风格】以目击者/发现者第一视角展开。元素可选：在不该看到的地方看到了什么、休息站/停车场/荒地中发现异常、被迫成为某个事件的唯一证人。画面感要强烈写实，像真实录像而非电影。',
  dashcam:       '【悬疑子类型：行车记录仪揭示】关键信息藏在画面背景中，观众第一遍看不到。脚本必须设计一个"重播时刻"——第一幕正常行驶，中间幕通过字幕或角色反应引导观众回想画面，最后幕揭示背景中一直存在的异常细节。',
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

  const { storyTitle, storyIdea, genre, narrativeStyle, hookType, subGenre, seriesMode, seriesName, episodeNumber, influencers, durationS, lang, castRoles } = await req.json()

  const castDesc = (influencers as Influencer[]).map((inf, i) => {
    const roleName = (castRoles as Record<number, string> | undefined)?.[inf.id]
    const roleStr = roleName ? `，角色：${roleName}` : ''
    return `角色${i + 1}（演员：${inf.name}${roleStr}）：${inf.tagline}，性格：${inf.personality?.join('、') || '多样'}`
  }).join('\n')

  const langNote     = lang === 'en' ? 'Write all dialogue in English.' : '所有台词用中文写。'
  const genreDesc    = GENRE_PROMPT[genre] || '创意故事'
  const styleDesc    = STYLE_PROMPT[narrativeStyle] || '电影感叙事'
  const hookDesc     = HOOK_PROMPT[hookType] || HOOK_PROMPT['midaction']
  const subGenreDesc = SUBGENRE_PROMPT[subGenre] || ''
  // Fetch previous episode cliffhanger if series mode
  let prevCliffhanger = ''
  if (seriesMode && seriesName && episodeNumber > 1) {
    const { data: prevJob } = await supabase
      .from('jobs')
      .select('cliffhanger, script')
      .eq('user_id', user.id)
      .eq('series_name', seriesName)
      .eq('episode_number', episodeNumber - 1)
      .single()
    if (prevJob?.cliffhanger) {
      prevCliffhanger = prevJob.cliffhanger
    } else if (prevJob?.script && Array.isArray(prevJob.script)) {
      // Fallback: use last clip's dialogue as cliffhanger hint
      const lastClip = prevJob.script[prevJob.script.length - 1] as { dialogue?: string }
      prevCliffhanger = lastClip?.dialogue || ''
    }
  }

  const seriesDesc = seriesMode && seriesName
    ? `【系列剧指令】本集是《${seriesName}》第${episodeNumber}集。${
        episodeNumber > 1 && prevCliffhanger
          ? `上集悬念：「${prevCliffhanger}」——本集前10秒必须以令人满足的方式解答这个悬念。`
          : episodeNumber > 1 ? '前几集已铺垫悬念，本集前10秒必须解答上集悬念。'
          : '这是系列第一集，重点建立核心谜题。'
      }最后一幕必须以比本集更大的悬念结束，不得给出任何解答。`
    : ''

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

${subGenreDesc}

${seriesDesc}

${hookDesc}

- 每幕15秒以内
- shot_description 格式：[景别] + [运镜] + [主体动作] + [场景环境] + [光影色调]
  例："Medium shot, slow dolly in, character turning around with shocked expression, dimly lit alley, cold blue moonlight"
- shot_type 从以下选一个：极特写/特写/中近景/中景/中远景/全景/大远景/俯拍/仰拍/鸟瞰/过肩/第一视角
- camera_movement 从以下选一个：固定/慢推/急推/拉远/左摇/右摇/上摇/下摇/横移/环绕/跟随/上升/下降/左旋推进/右旋推进/变焦/手持
- 台词要符合角色性格，自然流畅
- 故事要有起承转合，有情感张力
- speaker字段填演员的slug（如没有对话可留空字符串）
- consistency_anchor：一句话精准描述本幕的视觉锁定元素，格式：「[角色外观]，[场景/地点]，[光线/时间]」例："Jake穿黑色夹克、三日胡须，坐在卡车驾驶座，深夜高速公路冷蓝色月光"。跨幕中同一角色/场景必须保持完全一致的anchor描述，以确保Kling多次调用间的视觉一致性。

以JSON数组返回：
[
  {
    "index": 0,
    "speaker": "influencer-slug或空字符串",
    "dialogue": "角色台词（无旁白时为空字符串）",
    "shot_description": "场景描述：[景别]+[运镜]+[主体动作]+[场景环境]+[光影色调]",
    "shot_type": "景别，从 极特写/特写/中近景/中景/中远景/全景/大远景/俯拍/仰拍/鸟瞰/过肩/第一视角 中选一个",
    "camera_movement": "运镜，从 固定/慢推/急推/拉远/左摇/右摇/上摇/下摇/横移/环绕/跟随/上升/下降/左旋推进/右旋推进/变焦/手持 中选一个",
    "consistency_anchor": "角色外观+场景+光线的一句话视觉锁定，跨幕同场景保持完全相同描述",
    "duration": 10
  }
]`

  try {
    const scriptArr = await callGeminiJson<Array<{dialogue?: string; shot_description?: string}>>({ systemPrompt: '', userPrompt: prompt })
    const lastClip = scriptArr[scriptArr.length - 1]
    const cliffhanger = lastClip?.dialogue || lastClip?.shot_description || ''
    return NextResponse.json({ script: scriptArr, cliffhanger })
  } catch (err) {
    return NextResponse.json({ error: `生成失败: ${(err as Error).message}` }, { status: 500 })
  }
}
