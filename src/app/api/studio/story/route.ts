import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitMultiShotVideo } from '@/lib/kling'
import { classifyKlingResponse } from '@/lib/video-router'
import { getPresignedUrl } from '@/lib/r2'
import { CREDIT_COSTS, getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits, failClipAndCheckJob } from '@/lib/job-service'
import type { ScriptClip, Influencer } from '@/types'

const NARRATIVE_VISUAL: Record<string, string> = {
  skit:      'situational comedy, exaggerated expressions, fast-paced',
  cinematic: 'cinematic lighting, careful composition, emotional depth, film quality',
  vlog:      'first-person vlog, handheld, direct to camera, authentic feel',
  manga:     'manga-inspired, dynamic angles, exaggerated motion, bold composition',
}

const SUBGENRE_VISUAL: Record<string, string> = {
  highway:       'dark empty highway at night, isolated, cold blue moonlight, desaturated color grade, high contrast shadows',
  psychological: 'claustrophobic interior spaces, dutch angle, shallow depth of field, warm amber with deep shadows',
  truecrime:     'raw handheld camera style, realistic lighting, documentary feel, muted desaturated tones',
  dashcam:       'dashcam footage aesthetic, wide lens, timestamp overlay, low-light grain, realistic car interior',
}

const BGM_VISUAL: Record<string, string> = {
  strings:   'tense string underscore',
  heartbeat: 'rhythmic heartbeat sound design',
  silence:   'complete silence — maximum dread',
  ambient:   'eerie ambient atmosphere',
  sting:     'sharp orchestral sting',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { storyTitle, storyIdea, genre, narrativeStyle, subGenre, seriesMode, seriesName, episodeNumber, influencerIds, platform, aspectRatio, durationS, script, lang } = await req.json()
  if (!influencerIds?.length || !platform || !script) {
    return apiError('Missing required fields', 400)
  }

  const { data: influencers } = await supabase
    .from('influencers').select('*').in('id', influencerIds)
  if (!influencers?.length) return apiError('Influencers not found', 404)

  const service = await createServiceClient()
  const creditError = await deductCredits(service, user.id, CREDIT_COSTS.story, `故事短片: ${storyTitle || storyIdea.slice(0, 30)}`)
  if (creditError) return creditError

  const title = storyTitle || `故事: ${storyIdea.slice(0, 20)}...`
  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    user_id: user.id, type: 'story', status: 'generating', language: lang || 'zh',
    title, platform, aspect_ratio: aspectRatio || '9:16',
    influencer_ids: influencerIds, duration_s: durationS, script, credit_cost: CREDIT_COSTS.story,
  }).select().single()
  if (jobErr) return apiError(jobErr.message, 500)

  const clips = script as ScriptClip[]
  const infMap = Object.fromEntries((influencers as Influencer[]).map(inf => [inf.slug, inf]))
  const primaryInf = influencers[0] as Influencer
  const styleVisual    = NARRATIVE_VISUAL[narrativeStyle] || 'cinematic style'
  const subGenreVisual = SUBGENRE_VISUAL[subGenre] || ''
  const totalDuration  = clips.reduce((sum, c) => sum + (c.duration || 5), 0)
  const seriesTag      = seriesMode && seriesName ? `Series: "${seriesName}" Episode ${episodeNumber}.` : ''

  const shotDescriptions = clips.map((c, i) => {
    const actor = infMap[c.speaker] || primaryInf
    const dialogue = c.dialogue ? ` ${actor.name} says: "${c.dialogue}"` : ''
    const bgmNote  = c.bgm && BGM_VISUAL[c.bgm] ? ` [Audio: ${BGM_VISUAL[c.bgm]}]` : ''
    return `Scene ${i + 1}: ${c.shot_description}.${dialogue}${bgmNote}`
  }).join('. ')
  const combinedPrompt = [
    `${primaryInf.name} (${primaryInf.tagline}), ${styleVisual}, ${genre} short film.`,
    subGenreVisual,
    seriesTag,
    `Voice: ${primaryInf.voice_prompt}.`,
    shotDescriptions,
    `Vertical format 9:16, cinematic quality, mystery atmosphere.`,
  ].filter(Boolean).join(' ')

  const { data: clipRows } = await service.from('clips').insert([{
    job_id: job.id, clip_index: 0, status: 'pending', prompt: combinedPrompt,
  }]).select()

  const frontalKey = primaryInf.frontal_image_url?.split('/dreamlab-assets/')[1]
  const imageUrl = frontalKey
    ? await getPresignedUrl(frontalKey)
    : primaryInf.frontal_image_url || ''

  const resp = await submitMultiShotVideo({
    imageUrl,
    prompt: combinedPrompt,
    shotType: 'intelligence',
    totalDuration,
    aspectRatio: aspectRatio || '9:16',
    callbackUrl: getCallbackUrl(),
  })

  const result = classifyKlingResponse(resp)
  if (result.taskId) {
    await service.from('clips').update({ status: 'submitted', kling_task_id: result.taskId })
      .eq('job_id', job.id).eq('clip_index', 0)
  } else {
    await failClipAndCheckJob(service, job.id, 0, result.error ?? 'Submit failed')
  }

  return NextResponse.json({ jobId: job.id })
}
