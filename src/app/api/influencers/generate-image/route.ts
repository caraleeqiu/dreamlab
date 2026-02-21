import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { uploadToR2 } from '@/lib/r2'
import { CREDIT_COSTS } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits } from '@/lib/job-service'
import { createLogger } from '@/lib/logger'

const logger = createLogger('generate-image')

// POST /api/influencers/generate-image
// body: { influencer_id, prompt, reference_image_base64?, is_first, type? }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { influencer_id, prompt, reference_image_base64, is_first, type } = await request.json()
  const cost = is_first ? 0 : CREDIT_COSTS.generate_influencer_image

  if (cost > 0) {
    const service = await createServiceClient()
    const creditError = await deductCredits(service, user.id, cost, 'generate_influencer_image')
    if (creditError) return creditError
  }

  // 真人类型自动增强 prompt，电影主角级写实感 + 安全区
  let enhancedPrompt = prompt
  if (type === 'human') {
    // 使用叙述式描述，参考真实摄影风格，强调自然不完美，确保人物在安全区内
    const realisticPrefix = `A cinematic portrait with SAFE MARGINS - the subject is centered with clear space around them, not cropped at edges. Half-body or head-and-shoulders framing, leaving breathing room on all sides. The subject is `
    const realisticSuffix = `. Shot with an 85mm portrait lens at f/1.8, creating beautiful bokeh. Dramatic Rembrandt lighting with soft golden hour warmth streaming from the side. The image has the intimate quality of a Humans of New York photo. Subtle Kodak Portra 400 film grain, natural skin texture with visible pores and authentic imperfections. No retouching. IMPORTANT: Leave 10% margin on all edges, do not crop the head or body at frame edges.`
    enhancedPrompt = realisticPrefix + prompt + realisticSuffix
  } else {
    // 非真人类型也添加安全区要求
    enhancedPrompt = `${prompt}. IMPORTANT: Center the subject with clear margins around it, leave 10% safe space on all edges, do not crop at frame boundaries.`
  }

  // 使用 Gemini 2.0 Flash Image Generation 模型
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            ...(reference_image_base64 ? [{
              inline_data: { mime_type: 'image/png', data: reference_image_base64 }
            }] : []),
            { text: enhancedPrompt }
          ]
        }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    }
  )

  const geminiData = await geminiRes.json()
  logger.info('Gemini Image API response', { status: geminiRes.status, hasCandidate: !!geminiData?.candidates?.[0] })

  const imageData = geminiData?.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data: string } }) => p.inlineData
  )?.inlineData?.data

  if (!imageData) {
    logger.error('Image generation failed', { error: geminiData.error })
    return apiError('图片生成失败，请稍后重试', 500)
  }

  // 检查 R2 是否配置完整
  const r2Configured = process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY

  if (r2Configured) {
    const buffer = Buffer.from(imageData, 'base64')
    const key = `influencers/user-${user.id}/${influencer_id ?? 'new'}/front_${Date.now()}.png`
    const url = await uploadToR2(key, buffer, 'image/png')
    return NextResponse.json({ url })
  } else {
    // R2 未配置时返回 base64 data URL (临时方案，生产环境应配置 R2)
    logger.warn('R2 not configured, returning base64 data URL')
    const dataUrl = `data:image/png;base64,${imageData}`
    return NextResponse.json({ url: dataUrl })
  }
}
