import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { uploadToR2 } from '@/lib/r2'

// POST /api/influencers/generate-tts
// body: { influencer_id, voice_prompt, sample_text, is_first }
// 扣 2 积分，调 Gemini TTS，上传 R2，返回音频 URL
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { influencer_id, voice_prompt, sample_text, is_first } = await request.json()
  const cost = is_first ? 0 : 2

  if (cost > 0) {
    const service = await createServiceClient()
    const { error: deductError } = await service.rpc('deduct_credits', {
      p_user_id: user.id,
      p_amount: cost,
      p_reason: 'generate_influencer_tts',
    })
    if (deductError?.message.includes('insufficient_credits')) {
      return NextResponse.json({ error: '积分不足（需要 2 积分）' }, { status: 402 })
    }
  }

  const text = sample_text || "Hey, I'm your new AI influencer. Let's create something amazing together."

  // 调 Gemini TTS (gemini-2.5-flash-preview-tts)
  const ttsRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }
            },
            // voice_prompt 作为 system instruction 影响风格
          }
        },
        systemInstruction: {
          parts: [{ text: `Speak in this style: ${voice_prompt}` }]
        }
      }),
    }
  )

  const ttsData = await ttsRes.json()
  const audioData = ttsData?.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data: string } }) => p.inlineData
  )?.inlineData?.data

  if (!audioData) {
    return NextResponse.json({ error: 'Gemini TTS 生成失败' }, { status: 500 })
  }

  const buffer = Buffer.from(audioData, 'base64')
  const key = `influencers/user-${user.id}/${influencer_id ?? 'new'}/voice_${Date.now()}.wav`
  const url = await uploadToR2(key, buffer, 'audio/wav')

  return NextResponse.json({ url })
}
