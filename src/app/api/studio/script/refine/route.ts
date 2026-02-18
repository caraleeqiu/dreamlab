import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/studio/script/refine
// body: { raw_script, language }
// 返回：{ refined: string }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { raw_script, language, influencer } = await request.json()
  const isZh = language !== 'en'

  const infDesc = influencer
    ? isZh
      ? `\n主持人：${influencer.name}（${influencer.tagline}）。${influencer.speaking_style ? `说话风格：${influencer.speaking_style}` : ''}`
      : `\nHost: ${influencer.name} (${influencer.tagline}). ${influencer.speaking_style ? `Speaking style: ${influencer.speaking_style}` : ''}`
    : ''

  const systemPrompt = isZh
    ? `你是专业视频脚本润色师。对用户提供的原始脚本进行优化：
1. 保留核心内容和观点，不随意添加或删除主题
2. 调整语言节奏，使其更适合视频播讲
3. 分段清晰，每段约15秒的说话内容
4. 语言风格符合主持人人设${infDesc}
直接返回优化后的文本，不要解释或加标题。`
    : `You are a professional video script editor. Refine the user's raw script:
1. Keep core content and ideas, do not add unrelated topics
2. Adjust pacing to suit video narration
3. Clear paragraphing, each paragraph roughly 15 seconds of speech
4. Match the host's personality and speaking style${infDesc}
Return only the refined text, no explanations or titles.`

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: raw_script }] }],
      }),
    }
  )

  const data = await res.json()
  const refined = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!refined) return NextResponse.json({ error: 'AI 润色失败' }, { status: 500 })

  return NextResponse.json({ refined })
}
