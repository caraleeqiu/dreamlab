import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/studio/link/extract
// body: { url, language }
// Returns: { summary: string, title: string }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, language } = await request.json()
  const isZh = language !== 'en'
  const trimmedUrl = (url ?? '').trim()

  if (!trimmedUrl) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

  // Platform detection — return friendly errors before hitting Jina
  const isWechat   = /mp\.weixin\.qq\.com/.test(trimmedUrl)
  const isBilibili = /bilibili\.com/.test(trimmedUrl)
  const isDouyin   = /douyin\.com/.test(trimmedUrl)
  const isXhs      = /xiaohongshu\.com/.test(trimmedUrl)
  const isTwitter  = /twitter\.com|x\.com/.test(trimmedUrl)

  if (isWechat) return NextResponse.json({
    error: isZh
      ? '微信公众号无法直接读取，请复制正文后使用「自定义脚本」'
      : 'WeChat articles require login. Copy the text and use the Script wizard.',
    fallback: 'script',
  }, { status: 422 })

  if (isBilibili || isDouyin) return NextResponse.json({
    error: isZh
      ? '暂不支持视频平台链接，请复制视频文案或简介后使用「自定义脚本」'
      : 'Video platform links are not supported. Copy the description and use the Script wizard.',
    fallback: 'script',
  }, { status: 422 })

  if (isXhs) return NextResponse.json({
    error: isZh
      ? '小红书链接需要登录，请复制笔记内容后使用「自定义脚本」'
      : 'Xiaohongshu requires login. Copy the content and use the Script wizard.',
    fallback: 'script',
  }, { status: 422 })

  let rawContent = ''
  let pageTitle   = ''

  if (isTwitter) {
    // Twitter/X: use oEmbed API (no auth required, single tweets only)
    try {
      const oembedRes = await fetch(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(trimmedUrl)}&omit_script=true`,
        { signal: AbortSignal.timeout(10000) },
      )
      if (!oembedRes.ok) throw new Error('oEmbed failed')
      const data = await oembedRes.json() as { html?: string; author_name?: string }
      rawContent = (data.html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      pageTitle  = data.author_name ? `Tweet by @${data.author_name}` : 'Twitter'
      if (!rawContent) throw new Error('empty')
    } catch {
      return NextResponse.json({
        error: isZh
          ? '仅支持单条推文，Thread 请复制全文后使用「自定义脚本」'
          : 'Only single tweets are supported. For threads, copy the text and use the Script wizard.',
        fallback: 'script',
      }, { status: 422 })
    }
  } else {
    // Jina AI Reader — strips nav/ads, returns clean article text
    const jinaUrl = `https://r.jina.ai/${trimmedUrl}`
    const jinaHeaders: Record<string, string> = { 'Accept': 'text/plain', 'X-Return-Format': 'text' }
    if (process.env.JINA_API_KEY) jinaHeaders['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`

    const jinaRes = await fetch(jinaUrl, { headers: jinaHeaders, signal: AbortSignal.timeout(30000) })
    if (!jinaRes.ok) return NextResponse.json({
      error: isZh
        ? `无法读取该链接（${jinaRes.status}），请复制正文后使用「自定义脚本」`
        : `Cannot read this URL (${jinaRes.status}). Copy the text and use the Script wizard.`,
      fallback: 'script',
    }, { status: 422 })

    const jinaText = await jinaRes.text()
    if (!jinaText.trim()) return NextResponse.json({
      error: isZh
        ? '页面内容为空，可能需要登录，请复制正文后使用「自定义脚本」'
        : 'Page content is empty, may require login. Copy the text and use the Script wizard.',
      fallback: 'script',
    }, { status: 422 })

    // Extract title from Jina response (usually the first line starting with "Title:")
    const titleLine = jinaText.split('\n').find(l => /^title:/i.test(l))
    pageTitle  = titleLine ? titleLine.replace(/^title:\s*/i, '').trim() : ''
    rawContent = jinaText.slice(0, 60000)
  }

  // Gemini summarisation
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
        contents: [{ parts: [{ text: `${pageTitle ? `标题：${pageTitle}\n\n` : ''}内容：${rawContent}` }] }],
      }),
    }
  )

  const geminiData = await geminiRes.json()
  const summary = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!summary) return NextResponse.json({ error: isZh ? 'AI 提炼失败' : 'AI extraction failed' }, { status: 500 })

  return NextResponse.json({ summary, title: pageTitle })
}
