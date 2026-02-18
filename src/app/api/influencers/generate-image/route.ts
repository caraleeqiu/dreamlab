import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { uploadToR2 } from '@/lib/r2'

// POST /api/influencers/generate-image
// body: { influencer_id, prompt, reference_image_url? }
// 扣 3 积分，调 Gemini img2img，上传 R2，返回图片 URL
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { influencer_id, prompt, reference_image_base64, is_first } = await request.json()
  const cost = is_first ? 0 : 3

  if (cost > 0) {
    const service = await createServiceClient()
    const { error: deductError } = await service.rpc('deduct_credits', {
      p_user_id: user.id,
      p_amount: cost,
      p_reason: 'generate_influencer_image',
    })
    if (deductError?.message.includes('insufficient_credits')) {
      return NextResponse.json({ error: '积分不足（需要 3 积分）' }, { status: 402 })
    }
  }

  // 调 Gemini imagen API（gemini-2.0-flash-exp-image-generation）
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

  if (!imageData) {
    return NextResponse.json({ error: 'Gemini 生成失败' }, { status: 500 })
  }

  // 上传到 R2
  const buffer = Buffer.from(imageData, 'base64')
  const key = `influencers/user-${user.id}/${influencer_id ?? 'new'}/front_${Date.now()}.png`
  const url = await uploadToR2(key, buffer, 'image/png')

  return NextResponse.json({ url })
}
