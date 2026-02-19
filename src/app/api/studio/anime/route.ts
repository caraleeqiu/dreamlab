import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitMultiShotVideo } from '@/lib/kling'
import { classifyKlingResponse } from '@/lib/video-router'
import { getPresignedUrl } from '@/lib/r2'
import { CREDIT_COSTS, getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits, failClipAndCheckJob } from '@/lib/job-service'
import { groupClips } from '@/lib/video-utils'
import type { ScriptClip } from '@/types'

const ANIME_STYLE_VISUAL: Record<string, string> = {
  cyberpunk: 'cyberpunk aesthetic, neon lights, futuristic cityscape, high-tech atmosphere',
  ancient:   'traditional Chinese painting style, ink wash, elegant oriental aesthetics',
  modern:    'modern urban style, fashionable, lifestyle scenes, clean composition',
  cute:      'cute anime style, kawaii, pastel colors, expressive character',
  fantasy:   'fantasy magic world, epic lighting, colorful special effects, mystical',
  minimal:   'minimalist, pure background, premium quality, elegant simplicity',
}


export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { brandName, productName, animeStyle, influencerId, platform, aspectRatio, script, lang } = await req.json()
  if (!brandName || !productName || !influencerId || !platform || !script) {
    return apiError('Missing required fields', 400)
  }

  const { data: influencer } = await supabase
    .from('influencers').select('*').eq('id', influencerId).single()
  if (!influencer) return apiError('Influencer not found', 404)

  const service = await createServiceClient()
  const creditError = await deductCredits(service, user.id, CREDIT_COSTS.anime, `anime: ${brandName} ${productName}`, lang || 'zh')
  if (creditError) return creditError

  const frontalKey = influencer.frontal_image_url?.split('/dreamlab-assets/')[1]
  const imageUrl = frontalKey
    ? await getPresignedUrl(frontalKey)
    : influencer.frontal_image_url || ''

  const clips = script as ScriptClip[]
  const styleVisual = ANIME_STYLE_VISUAL[animeStyle] || 'anime style'
  const stylePrefix = `${influencer.name} (${influencer.tagline}), ${styleVisual}. Brand: ${brandName}, product: ${productName}. Voice: ${influencer.voice_prompt}.`

  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    user_id: user.id, type: 'anime', status: 'generating', language: lang || 'zh',
    title: lang === 'en' ? `Anime: ${brandName} × ${influencer.name}` : `动漫营销: ${brandName} × ${influencer.name}`, platform, aspect_ratio: aspectRatio || '9:16',
    influencer_ids: [influencerId], script, credit_cost: CREDIT_COSTS.anime,
  }).select().single()
  if (jobErr) {
    // Job creation failed after credits were deducted — refund immediately
    await service.rpc('add_credits', {
      p_user_id: user.id,
      p_amount: CREDIT_COSTS.anime,
      p_reason: `refund:job_create_failed`,
    })
    return apiError(jobErr.message, 500)
  }

  // Subject Library: element_id for character consistency; voice_id for fixed timbre
  const elementEntry = influencer.kling_element_id
    ? { element_id: influencer.kling_element_id }
    : { frontal_image_url: imageUrl }
  const voiceList = influencer.kling_element_voice_id
    ? [{ voice_id: influencer.kling_element_voice_id }]
    : undefined

  const MOTION_SUFFIX = 'natural micro-movements, subtle expressive gestures, dynamic environment with gentle background motion'
  const callbackUrl = getCallbackUrl()
  const groups = groupClips(clips)

  const clipInserts = groups.map((_, gi) => ({
    job_id: job.id, clip_index: gi, status: 'pending', prompt: '', provider: 'kling',
  }))
  const { data: clipRows } = await service.from('clips').insert(clipInserts).select()

  await Promise.allSettled(groups.map(async (group, gi) => {
    const groupDuration = Math.min(group.reduce((s, c) => s + (c.duration || 5), 0), 15)

    let resp
    if (group.length === 1) {
      const c = group[0]
      const anchorNote = c.consistency_anchor ? `[Scene anchor: ${c.consistency_anchor}]` : ''
      const prompt = [
        stylePrefix, anchorNote,
        `Scene: ${c.shot_description}`,
        c.dialogue ? `${influencer.name} says: "${c.dialogue}"` : '',
        MOTION_SUFFIX,
        'Vertical format, premium anime animation.',
      ].filter(Boolean).join(' ')

      resp = await submitMultiShotVideo({
        imageUrl,
        prompt,
        shotType: 'intelligence',
        totalDuration: groupDuration,
        aspectRatio: aspectRatio || '9:16',
        elementList: [elementEntry],
        voiceList,
        callbackUrl,
      })
    } else {
      resp = await submitMultiShotVideo({
        imageUrl,
        shots: group.map((c, si) => {
          const anchorNote = c.consistency_anchor ? `[Scene anchor: ${c.consistency_anchor}]` : ''
          return {
            index: si + 1,
            prompt: [
              `${stylePrefix} Shot ${si + 1}:`,
              anchorNote, c.shot_description,
              c.dialogue ? `${influencer.name} says: "${c.dialogue}"` : '',
              MOTION_SUFFIX,
            ].filter(Boolean).join(' '),
            duration: c.duration || 5,
          }
        }),
        shotType: 'customize',
        totalDuration: groupDuration,
        aspectRatio: aspectRatio || '9:16',
        elementList: [elementEntry],
        voiceList,
        callbackUrl,
      })
    }

    const result = classifyKlingResponse(resp)
    if (result.taskId) {
      await service.from('clips')
        .update({ status: 'submitted', kling_task_id: result.taskId })
        .eq('job_id', job.id).eq('clip_index', gi)
    } else {
      await failClipAndCheckJob(service, job.id, gi, result.error ?? 'Submit failed')
    }
  }))

  return NextResponse.json({ jobId: job.id })
}
