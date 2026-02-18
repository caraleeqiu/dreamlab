import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

const GEMINI_KEY = process.env.GEMINI_API_KEY!
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// POST /api/studio/anime/extract-product
// Body: { input: string (URL or text), lang: 'zh' | 'en' }
// Returns: { brandName, productName, productDesc, targetAudience, suggestedCategory }
// suggestedCategory: 'eat' | 'wear' | 'play' | 'use'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { input, lang } = await request.json() as { input?: string; lang?: string }
  if (!input?.trim()) return NextResponse.json({ error: 'input required' }, { status: 400 })

  const isZh = lang !== 'en'

  // If input looks like a URL, fetch it via Jina reader first
  let content = input.trim()
  const looksLikeUrl = /^https?:\/\//i.test(content)

  if (looksLikeUrl) {
    try {
      const jinaUrl = `https://r.jina.ai/${content}`
      const jinaHeaders: Record<string, string> = { Accept: 'text/plain', 'X-Return-Format': 'text' }
      if (process.env.JINA_API_KEY) jinaHeaders['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`
      const jinaRes = await fetch(jinaUrl, { headers: jinaHeaders, signal: AbortSignal.timeout(15000) })
      if (jinaRes.ok) {
        const text = await jinaRes.text()
        if (text.trim()) content = text.slice(0, 8000) // cap at 8K chars
      }
    } catch {
      // Fall back to treating input as raw text
    }
  }

  const prompt = isZh
    ? `你是产品信息提取专家。从以下产品信息中提取关键字段，并根据产品类型判断最匹配的营销分类。

产品信息：
${content}

分类说明：
- eat：食品·饮品·零食·餐饮·外卖
- wear：服装·美妆·护肤·时尚配饰·鞋包
- play：探店·旅游·游戏·娱乐·演出·体验
- use：数码·工具·家居·家电·效率·健身器材

严格返回 JSON（不含 markdown 代码块）：
{
  "brandName": "品牌名，如无则留空",
  "productName": "产品名或产品线，如无则留空",
  "productDesc": "核心卖点，50字以内，如无则留空",
  "targetAudience": "目标受众描述，如无则留空",
  "suggestedCategory": "eat|wear|play|use 之一"
}`
    : `You are a product information extractor. Extract key fields from the product info below and determine the best marketing category.

Product info:
${content}

Category definitions:
- eat: Food, drinks, snacks, restaurants, delivery
- wear: Clothing, beauty, skincare, fashion accessories, shoes & bags
- play: Venues, travel, games, entertainment, events, experiences
- use: Tech, tools, home appliances, productivity, fitness equipment

Return strict JSON (no markdown code blocks):
{
  "brandName": "brand name, or empty string if unknown",
  "productName": "product or product line name, or empty string",
  "productDesc": "key selling points, max 30 words, or empty string",
  "targetAudience": "target audience description, or empty string",
  "suggestedCategory": "one of: eat|wear|play|use"
}`

  const geminiBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  }

  const geminiRes = await fetch(
    `${GEMINI_BASE}/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
  )

  const geminiData = await geminiRes.json()
  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    console.error('Gemini extract-product error:', JSON.stringify(geminiData))
    return NextResponse.json({ error: 'AI 解析失败' }, { status: 500 })
  }

  try {
    const parsed = JSON.parse(text)
    const validCategories = ['eat', 'wear', 'play', 'use']
    return NextResponse.json({
      brandName: parsed.brandName || '',
      productName: parsed.productName || '',
      productDesc: parsed.productDesc || '',
      targetAudience: parsed.targetAudience || '',
      suggestedCategory: validCategories.includes(parsed.suggestedCategory) ? parsed.suggestedCategory : null,
    })
  } catch {
    return NextResponse.json({ error: '解析失败', raw: text }, { status: 500 })
  }
}
