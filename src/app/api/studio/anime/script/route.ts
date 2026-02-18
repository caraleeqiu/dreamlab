import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ANIME_STYLE_PROMPTS: Record<string, string> = {
  cyberpunk: '赛博朋克风格，霓虹灯光，未来都市，科技感强',
  ancient: '中国古风，水墨画风，东方美学，古典优雅',
  modern: '现代都市风格，时尚感，生活化场景',
  cute: '二次元动漫风格，可爱萌系，Q版角色',
  fantasy: '奇幻魔法世界，史诗感，炫彩特效',
  minimal: '极简主义，纯净背景，高端质感',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandName, productName, productDesc, targetAudience, animeStyle, influencer, lang } = await req.json()

  const styleDesc = ANIME_STYLE_PROMPTS[animeStyle] || '动漫风格'
  const langNote = lang === 'en' ? 'Write in English.' : '用中文写。'

  const prompt = `你是一位顶级广告创意总监，专注于动漫风格营销短片。
${langNote}

品牌：${brandName}
产品：${productName}
产品卖点：${productDesc || '无'}
目标受众：${targetAudience || '年轻人'}
代言IP：${influencer.name}（${influencer.tagline}）
动漫风格：${styleDesc}

请创作一个15-20秒的动漫营销短视频脚本，分3-4个场景。
每个场景包含：动漫场景描述（视觉画面）+ IP台词（口播文案，可选）。

以JSON格式返回：
[
  {
    "index": 0,
    "speaker": "${influencer.slug}",
    "dialogue": "台词（如果有口播）或空字符串",
    "shot_description": "详细的动漫场景描述，包括风格、色调、人物动作、特效",
    "duration": 5
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
          generationConfig: { responseMimeType: 'application/json', temperature: 0.9 },
        }),
      }
    )
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const script = JSON.parse(text)
    return NextResponse.json({ script })
  } catch (e: unknown) {
    console.error('Anime script error:', e)
    return NextResponse.json({ error: 'Script generation failed' }, { status: 500 })
  }
}
