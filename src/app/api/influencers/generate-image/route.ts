import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { uploadToR2 } from '@/lib/r2'
import { CREDIT_COSTS } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits } from '@/lib/job-service'

// POST /api/influencers/generate-image
// body: { influencer_id, prompt, reference_image_base64?, is_first }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { influencer_id, prompt, reference_image_base64, is_first } = await request.json()
  const cost = is_first ? 0 : CREDIT_COSTS.generate_influencer_image

  if (cost > 0) {
    const service = await createServiceClient()
    const creditError = await deductCredits(service, user.id, cost, 'generate_influencer_image')
    if (creditError) return creditError
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            ...(reference_image_base64 ? [{
              inline_data: { mime_type: 'image/png', data: reference_image_base64 }
            }] : []),
            { text: prompt }
          ]
        }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    }
  )

  const geminiData = await geminiRes.json()
  const imageData = geminiData?.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data: string } }) => p.inlineData
  )?.inlineData?.data

  if (!imageData) return apiError('Gemini 生成失败', 500)

  const buffer = Buffer.from(imageData, 'base64')
  const key = `influencers/user-${user.id}/${influencer_id ?? 'new'}/front_${Date.now()}.png`
  const url = await uploadToR2(key, buffer, 'image/png')

  return NextResponse.json({ url })
}
