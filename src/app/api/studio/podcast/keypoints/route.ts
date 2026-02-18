import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/studio/podcast/keypoints
// body: { topics: [{title, angle}], language }
// 返回：{ perspective?, keypoints: string[] }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topics, language } = await request.json()
  const isZh = language !== 'en'
  const isTwoTopics = topics.length === 2

  const systemPrompt = isZh
    ? `你是一位经验丰富的播客编辑，擅长从热点话题中提炼最有价值的观点。请用简洁、有力的语言输出，每条要点15-25字。`
    : `You are an experienced podcast editor who extracts the most valuable insights from trending topics. Be concise and punchy, each keypoint 10-20 words.`

  const userPrompt = isTwoTopics
    ? (isZh
        ? `以下是两个热点话题，请先找出它们之间的连接视角（perspective），再基于这个视角提炼6-8个核心要点。

话题1：${topics[0].title}
解说角度：${topics[0].angle}

话题2：${topics[1].title}
解说角度：${topics[1].angle}

请严格返回 JSON 格式：
{"perspective": "本期连接视角（一句话）", "keypoints": ["要点1", "要点2", ...]}`
        : `Here are two trending topics. Find the connecting perspective and extract 6-8 keypoints based on that angle.

Topic 1: ${topics[0].title}
Angle: ${topics[0].angle}

Topic 2: ${topics[1].title}
Angle: ${topics[1].angle}

Return JSON: {"perspective": "one-sentence connecting angle", "keypoints": ["point1", "point2", ...]}`)
    : (isZh
        ? `以下是一个热点话题，请提炼6-8个核心要点，供播客讨论使用。

话题：${topics[0].title}
解说角度：${topics[0].angle}

请严格返回 JSON 格式：
{"keypoints": ["要点1", "要点2", ...]}`
        : `Extract 6-8 keypoints from this trending topic for a podcast discussion.

Topic: ${topics[0].title}
Angle: ${topics[0].angle}

Return JSON: {"keypoints": ["point1", "point2", ...]}`)

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
  if (!text) return NextResponse.json({ error: 'AI 生成失败' }, { status: 500 })

  try {
    const parsed = JSON.parse(text)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: '解析失败', raw: text }, { status: 500 })
  }
}
