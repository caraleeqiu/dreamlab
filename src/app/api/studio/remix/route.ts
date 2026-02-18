import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitSimpleVideo } from '@/lib/kling'
import type { Influencer } from '@/types'

const CREDIT_COST = 5

const REMIX_STYLE_LABELS: Record<string, string> = {
  commentary: '网红解说', reaction: '反应视频', duet: '合拍二创', remake: '同款翻拍',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoUrl, videoTitle, influencerId, platform, remixStyle, aspectRatio, lang } = await req.json()
  if (!videoUrl || !influencerId || !platform) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: influencer } = await supabase
    .from('influencers').select('*').eq('id', influencerId).single()
  if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })

  const service = await createServiceClient()

  // Deduct credits
  const { error: deductErr } = await service.rpc('deduct_credits', {
    p_user_id: user.id, p_amount: CREDIT_COST, p_reason: `爆款二创: ${videoTitle || videoUrl.slice(0, 40)}`,
  })
  if (deductErr?.message?.includes('insufficient_credits')) {
    return NextResponse.json({ error: 'insufficient_credits' }, { status: 402 })
  }

  // Generate script via Gemini
  let script: Array<{ index: number; speaker: string; dialogue: string; shot_description: string; duration: number }> = []
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text:
            `你是${influencer.name}，${influencer.tagline}。\n说话风格：${influencer.speaking_style || '自然活泼'}\n\n为以下视频做"${REMIX_STYLE_LABELS[remixStyle] || '二创'}"：\n视频：${videoUrl}\n标题：${videoTitle || ''}\n\n生成${platform}竖屏短视频脚本（${aspectRatio}），约30秒，3-4片段，以你的风格解读。\n\nJSON格式：[{"index":0,"speaker":"${influencer.slug}","dialogue":"台词","shot_description":"分镜描述","duration":8}]`
          }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    )
    const d = await res.json()
    script = JSON.parse(d.candidates?.[0]?.content?.parts?.[0]?.text || '[]')
  } catch {
    script = [{ index: 0, speaker: influencer.slug, dialogue: `来看这个视频，我来解读一下。`, shot_description: '网红正面出镜', duration: 10 }]
  }

  // Create job
  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    user_id: user.id, type: 'remix', status: 'generating', language: lang || 'zh',
    title: `二创: ${videoTitle || videoUrl.slice(0, 40)}`,
    platform, aspect_ratio: aspectRatio || '9:16',
    influencer_ids: [influencerId], script, credit_cost: CREDIT_COST,
  }).select().single()
  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })

  // Create clips + submit to Kling
  const clipInserts = script.map(clip => ({ job_id: job.id, clip_index: clip.index, status: 'pending', prompt: '' }))
  const { data: clips } = await service.from('clips').insert(clipInserts).select()

  const styleDescMap: Record<string, string> = { commentary: 'commentary style', reaction: 'reaction video', duet: 'duet', remake: 'remake/recreation' }
  const styleDesc = styleDescMap[remixStyle as string] || ''
  const CALLBACK = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/kling`

  await Promise.allSettled(script.map(async (clip) => {
    const prompt = `${clip.shot_description}. ${influencer.name}: ${influencer.speaking_style || 'energetic'}. [VOICE: ${influencer.voice_prompt}]. "${clip.dialogue}". ${styleDesc}`
    const resp = await submitSimpleVideo({ prompt, imageUrl: influencer.frontal_image_url || '', durationS: clip.duration, aspectRatio: aspectRatio || '9:16', callbackUrl: CALLBACK })
    const taskId = resp?.data?.task_id
    if (taskId && clips) {
      await service.from('clips').update({ status: 'submitted', kling_task_id: taskId, prompt })
        .eq('job_id', job.id).eq('clip_index', clip.index)
    }
  }))

  return NextResponse.json({ jobId: job.id })
}
