import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_API_KEY = process.env.GEMINI_API_KEY

// 根据性格选择语音
function selectVoice(personality: string[], gender?: string): string {
  const traits = personality.join(' ').toLowerCase()

  // 检测性别倾向
  const isFemale = gender === 'female' ||
    traits.includes('cute') || traits.includes('soft') ||
    traits.includes('萌') || traits.includes('可爱') ||
    traits.includes('温柔') || traits.includes('甜')

  if (isFemale) {
    if (traits.includes('cute') || traits.includes('soft') || traits.includes('萌')) {
      return 'en-US-Chirp3-HD-Despina' // 软萌
    }
    if (traits.includes('energetic') || traits.includes('passionate') || traits.includes('活泼')) {
      return 'en-US-Chirp3-HD-Autonoe' // 活泼
    }
    return 'en-US-Chirp3-HD-Aoede' // 温暖
  } else {
    if (traits.includes('cool') || traits.includes('cold') || traits.includes('冷')) {
      return 'en-US-Chirp3-HD-Achird' // 成熟
    }
    return 'en-US-Chirp3-HD-Charon' // 少年
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, personality, gender } = await request.json()

    if (!name || !personality || !Array.isArray(personality)) {
      return NextResponse.json({ error: 'Missing name or personality' }, { status: 400 })
    }

    const voice = selectVoice(personality, gender)
    const traits = personality.slice(0, 3).join(', ')
    const text = `Hi, I'm ${name}. I'm ${traits}.`

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'en-US', name: voice },
          audioConfig: { audioEncoding: 'MP3' }
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('TTS error:', error)
      return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 })
    }

    const data = await response.json()
    const audioContent = data.audioContent

    // 返回 base64 音频
    return NextResponse.json({
      audio: `data:audio/mp3;base64,${audioContent}`,
      text
    })
  } catch (error) {
    console.error('TTS error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
