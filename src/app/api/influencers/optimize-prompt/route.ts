import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'

// POST /api/influencers/optimize-prompt
// 使用 AI 优化用户输入的图片 prompt
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { prompt, type, name, personality } = await request.json()

  if (!prompt) {
    return apiError('Missing prompt', 400)
  }

  // 使用 Gemini 优化 prompt
  const systemPrompt = `You are an expert at writing prompts for AI image generation.
Your task is to enhance the user's description into a detailed, professional prompt.

Rules:
1. Keep the original intent and characteristics
2. Add specific visual details: lighting, composition, style
3. For "human" type: make it photorealistic, cinematic portrait style
4. For "animal" type: make it cute and expressive
5. For "virtual" type: make it anime/illustration style
6. For "brand" type: make it mascot-friendly and memorable
7. Always include: "9:16 aspect ratio, centered composition with safe margins"
8. Output ONLY the optimized prompt, no explanation
9. Keep it concise (under 200 words)
10. Write in English for best results`

  const userMessage = `Type: ${type || 'human'}
Name: ${name || 'Unknown'}
Personality: ${personality?.join(', ') || 'N/A'}
User's description: ${prompt}

Please optimize this into a professional image generation prompt.`

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userMessage }] }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    )

    const data = await geminiRes.json()
    const optimizedPrompt = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!optimizedPrompt) {
      return apiError('优化失败，请重试', 500)
    }

    return NextResponse.json({ optimizedPrompt })
  } catch {
    return apiError('优化失败，请重试', 500)
  }
}
