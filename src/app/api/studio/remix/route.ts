import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitSimpleVideo } from '@/lib/kling'
import { classifyKlingResponse } from '@/lib/video-router'
import { CREDIT_COSTS, getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits, createClipRecords, failClipAndCheckJob } from '@/lib/job-service'
import { callGeminiJson } from '@/lib/gemini'
import type { Influencer } from '@/types'

const REMIX_STYLE_LABELS: Record<string, string> = {
  commentary: '网红解说', reaction: '反应视频', duet: '合拍二创', remake: '同款翻拍',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { videoUrl, videoTitle, influencerId, platform, remixStyle, aspectRatio, lang } = await req.json()
  if (!videoUrl || !influencerId || !platform) {
    return apiError('Missing required fields', 400)
  }

  const { data: influencer } = await supabase
    .from('influencers').select('*').eq('id', influencerId).single()
  if (!influencer) return apiError('Influencer not found', 404)

  const service = await createServiceClient()
  const creditError = await deductCredits(service, user.id, CREDIT_COSTS.remix, `remix: ${videoTitle || videoUrl.slice(0, 40)}`, lang || 'zh')
  if (creditError) return creditError

  // Generate script via Gemini
  type RemixClip = { index: number; speaker: string; dialogue: string; shot_description: string; duration: number }
  let script: RemixClip[] = []
  try {
    const userPrompt = `你是${influencer.name}，${influencer.tagline}。\n说话风格：${influencer.speaking_style || '自然活泼'}\n\n为以下视频做"${REMIX_STYLE_LABELS[remixStyle] || '二创'}"：\n视频：${videoUrl}\n标题：${videoTitle || ''}\n\n生成${platform}竖屏短视频脚本（${aspectRatio}），约30秒，3-4片段，以你的风格解读。\n\nJSON格式：[{"index":0,"speaker":"${influencer.slug}","dialogue":"台词","shot_description":"分镜描述","duration":8}]`
    script = await callGeminiJson<RemixClip[]>({
      systemPrompt: `You are ${influencer.name}, ${influencer.tagline}.`,
      userPrompt,
    })
  } catch {
    script = [{ index: 0, speaker: influencer.slug, dialogue: `来看这个视频，我来解读一下。`, shot_description: '网红正面出镜', duration: 10 }]
  }

  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    user_id: user.id, type: 'remix', status: 'generating', language: lang || 'zh',
    title: lang === 'en' ? `Remix: ${videoTitle || videoUrl.slice(0, 40)}` : `二创: ${videoTitle || videoUrl.slice(0, 40)}`,
    platform, aspect_ratio: aspectRatio || '9:16',
    influencer_ids: [influencerId], script, credit_cost: CREDIT_COSTS.remix,
  }).select().single()
  if (jobErr) {
    await service.rpc('add_credits', {
      p_user_id: user.id,
      p_amount: CREDIT_COSTS.remix,
      p_reason: `refund:job_create_failed`,
    })
    return apiError(jobErr.message, 500)
  }

  const clips = await createClipRecords(service, job.id, script)
  const styleDescMap: Record<string, string> = { commentary: 'commentary style', reaction: 'reaction video', duet: 'duet', remake: 'remake/recreation' }
  const styleDesc = styleDescMap[remixStyle as string] || ''
  const callbackUrl = getCallbackUrl()

  await Promise.allSettled(script.map(async (clip) => {
    const prompt = `${clip.shot_description}. ${influencer.name}: ${influencer.speaking_style || 'energetic'}. [VOICE: ${influencer.voice_prompt}]. "${clip.dialogue}". ${styleDesc}`
    const resp = await submitSimpleVideo({ prompt, imageUrl: influencer.frontal_image_url || '', durationS: clip.duration, aspectRatio: aspectRatio || '9:16', callbackUrl })
    const result = classifyKlingResponse(resp)
    if (result.taskId) {
      await service.from('clips').update({ status: 'submitted', kling_task_id: result.taskId, prompt })
        .eq('job_id', job.id).eq('clip_index', clip.index)
    } else {
      await failClipAndCheckJob(service, job.id, clip.index, result.error ?? 'Submit failed')
    }
  }))

  return NextResponse.json({ jobId: job.id })
}
