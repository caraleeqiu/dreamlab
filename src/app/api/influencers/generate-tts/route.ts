import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { uploadToR2 } from '@/lib/r2'
import { CREDIT_COSTS } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits } from '@/lib/job-service'

// POST /api/influencers/generate-tts
// body: { influencer_id, voice_prompt, sample_text, is_first }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { influencer_id, voice_prompt, sample_text, is_first } = await request.json()
  const cost = is_first ? 0 : CREDIT_COSTS.generate_influencer_tts

  if (cost > 0) {
    const service = await createServiceClient()
    const creditError = await deductCredits(service, user.id, cost, 'generate_influencer_tts')
    if (creditError) return creditError
  }

  const text = sample_text || "Hey, I'm your new AI influencer. Let's create something amazing together."

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

  if (!audioData) return apiError('Gemini TTS 生成失败', 500)

  const buffer = Buffer.from(audioData, 'base64')
  const key = `influencers/user-${user.id}/${influencer_id ?? 'new'}/voice_${Date.now()}.wav`
  const url = await uploadToR2(key, buffer, 'audio/wav')

  return NextResponse.json({ url })
}
