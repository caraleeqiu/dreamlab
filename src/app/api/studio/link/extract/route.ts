import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/studio/link/extract
// body: { url, language }
// 返回：{ summary: string, title: string }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, language } = await request.json()
  const isZh = language !== 'en'

  // 1. 抓取 URL 内容
  let rawContent = ''
  let pageTitle = ''

  try {
    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DreamlabBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,*/*',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!fetchRes.ok) {
      return NextResponse.json({ error: `无法访问该链接（HTTP ${fetchRes.status}）` }, { status: 422 })
    }

    const html = await fetchRes.text()

    // 提取 title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    pageTitle = titleMatch ? titleMatch[1].trim() : ''

    // 粗提取正文：去除 script/style 标签，保留文字
    rawContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000) // 限制长度
  } catch (err) {
    return NextResponse.json({
      error: '链接抓取失败，可能是微信公众号或需要登录的页面。请手动复制正文后使用「自定义脚本」流程。',
    }, { status: 422 })
  }

  if (!rawContent || rawContent.length < 100) {
    return NextResponse.json({
      error: '页面内容过少，无法提取。请手动复制正文后使用「自定义脚本」流程。',
    }, { status: 422 })
  }

  // 2. Gemini 提炼摘要
  const systemPrompt = isZh
    ? `你是内容提炼专家。从网页内容中提取核心信息，整理为适合视频脚本的摘要。
要求：
1. 保留关键事实、数据、观点
2. 去除广告、导航、无关内容
3. 用流畅的中文段落呈现，每段约100-150字
4. 总长度控制在300-600字`
    : `You are a content extraction expert. Extract key information from webpage content and format it as a video script summary.
Requirements:
1. Keep key facts, data, and opinions
2. Remove ads, navigation, irrelevant content
3. Present in smooth paragraphs, each about 100-150 words
4. Total length 300-600 words`

  const geminiRes = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: `标题：${pageTitle}\n\n内容：${rawContent}` }] }],
      }),
    }
  )

  const geminiData = await geminiRes.json()
  const summary = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!summary) return NextResponse.json({ error: 'AI 提炼失败' }, { status: 500 })

  return NextResponse.json({ summary, title: pageTitle })
}
