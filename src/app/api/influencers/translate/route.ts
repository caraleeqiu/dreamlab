import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'

// POST /api/influencers/translate
// 翻译用户自建网红的文本内容
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { texts, targetLang } = await request.json() as {
    texts: { tagline?: string; personality?: string[]; domains?: string[]; speaking_style?: string }
    targetLang: 'en' | 'zh'
  }

  const prompt = targetLang === 'en'
    ? `Translate the following Chinese influencer profile to natural English. Keep it concise and impactful. Return JSON only.

Input:
${JSON.stringify(texts, null, 2)}

Output format:
{
  "tagline": "translated tagline",
  "personality": ["trait1", "trait2", ...],
  "domains": ["domain1", "domain2", ...],
  "speaking_style": "translated speaking style"
}`
    : `Translate the following English influencer profile to natural Chinese. Keep it concise and impactful. Return JSON only.

Input:
${JSON.stringify(texts, null, 2)}

Output format:
{
  "tagline": "翻译后的标语",
  "personality": ["特点1", "特点2", ...],
  "domains": ["领域1", "领域2", ...],
  "speaking_style": "翻译后的说话风格"
}`

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )

  const data = await geminiRes.json()
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!content) {
    return apiError('Translation failed', 500)
  }

  try {
    const translated = JSON.parse(content)
    return NextResponse.json(translated)
  } catch {
    return apiError('Invalid translation response', 500)
  }
}
