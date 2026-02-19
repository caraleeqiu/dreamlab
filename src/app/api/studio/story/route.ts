import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitMultiShotVideo } from '@/lib/kling'
import { classifyKlingResponse } from '@/lib/video-router'
import { groupClips } from '@/lib/video-utils'
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

  const { storyTitle, storyIdea, genre, narrativeStyle, subGenre, seriesMode, seriesName, episodeNumber, influencerIds, platform, aspectRatio, durationS, script, lang, castRoles, cliffhanger } = await req.json()
  if (!influencerIds?.length || !platform || !script) {
    return apiError('Missing required fields', 400)
  }

  const { data: influencers } = await supabase
    .from('influencers').select('*').in('id', influencerIds)
  if (!influencers?.length) return apiError('Influencers not found', 404)

  const service = await createServiceClient()
  const creditError = await deductCredits(service, user.id, CREDIT_COSTS.story, `story: ${storyTitle || storyIdea.slice(0, 30)}`, lang || 'zh')
  if (creditError) return creditError

  const title = storyTitle || (lang === 'en' ? `Story: ${storyIdea.slice(0, 20)}...` : `故事: ${storyIdea.slice(0, 20)}...`)

  const clips = script as ScriptClip[]
  const lastClip = clips[clips.length - 1]
  const derivedCliffhanger = cliffhanger || lastClip?.dialogue || lastClip?.shot_description || ''

  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    user_id: user.id, type: 'story', status: 'generating', language: lang || 'zh',
    title, platform, aspect_ratio: aspectRatio || '9:16',
    influencer_ids: influencerIds, duration_s: durationS, script, credit_cost: CREDIT_COSTS.story,
    series_name: seriesMode ? (seriesName || null) : null,
    episode_number: seriesMode ? (episodeNumber || null) : null,
    cliffhanger: derivedCliffhanger,
  }).select().single()
  if (jobErr) {
    await service.rpc('add_credits', {
      p_user_id: user.id,
      p_amount: CREDIT_COSTS.story,
      p_reason: `refund:job_create_failed`,
    })
    return apiError(jobErr.message, 500)
  }

  const infMap = Object.fromEntries((influencers as Influencer[]).map(inf => [inf.slug, inf]))
  const primaryInf = influencers[0] as Influencer
  const styleVisual    = NARRATIVE_VISUAL[narrativeStyle] || 'cinematic style'
  const subGenreVisual = SUBGENRE_VISUAL[subGenre] || ''
  const seriesTag      = seriesMode && seriesName ? `Series: "${seriesName}" Episode ${episodeNumber}.` : ''

  const frontalKey = primaryInf.frontal_image_url?.split('/dreamlab-assets/')[1]
  const imageUrl = frontalKey
    ? await getPresignedUrl(frontalKey)
    : primaryInf.frontal_image_url || ''

  const callbackUrl = getCallbackUrl()
  const groups = groupClips(clips)

  // Insert one clip record per group
  const clipInserts = groups.map((_, gi) => ({
    job_id: job.id, clip_index: gi, status: 'pending', prompt: '', provider: 'kling',
  }))
  await service.from('clips').insert(clipInserts)

  // Build style prefix for prompts
  const stylePrefix = [
    `${primaryInf.name} (${primaryInf.tagline}), ${styleVisual}, ${genre} short film.`,
    subGenreVisual,
    seriesTag,
    `Voice: ${primaryInf.voice_prompt}.`,
  ].filter(Boolean).join(' ')

  // ── Frame-chained sequential submission ──────────────────────────────────
  // Story videos use frame chaining to maintain temporal continuity:
  //   - Group 0 is submitted immediately to Kling
  //   - Groups 1..N are stored as "deferred" payloads in clips.prompt (JSON)
  //   - The webhook extracts the last frame of group N and submits group N+1
  //     with that frame as first_frame, then clears the deferred payload
  //
  // This ensures the character's position/action flows naturally between clips
  // instead of "teleporting" at each group boundary.

  function buildGroupPayload(group: ScriptClip[], gi: number) {
    const groupDuration = Math.min(group.reduce((s, c) => s + (c.duration || 5), 0), 15)
    if (group.length === 1) {
      const c = group[0]
      const actor = infMap[c.speaker] || primaryInf
      const rolePart = castRoles?.[actor.id] ? ` as ${castRoles[actor.id]}` : ''
      const bgmNote = c.bgm && BGM_VISUAL[c.bgm] ? ` [Audio: ${BGM_VISUAL[c.bgm]}]` : ''
      const anchorNote = c.consistency_anchor ? `[Visual anchor: ${c.consistency_anchor}]` : ''
      return {
        kind: 'single' as const,
        groupIndex: gi,
        imageUrl,
        prompt: [
          stylePrefix, anchorNote,
          `Scene: ${c.shot_description}.`,
          c.dialogue ? `${actor.name}${rolePart} says: "${c.dialogue}"` : '',
          bgmNote,
          'Vertical format 9:16, cinematic quality, mystery atmosphere.',
        ].filter(Boolean).join(' '),
        shotType: 'intelligence' as const,
        totalDuration: groupDuration,
        aspectRatio: aspectRatio || '9:16',
        callbackUrl,
      }
    } else {
      return {
        kind: 'multi' as const,
        groupIndex: gi,
        imageUrl,
        shots: group.map((c, si) => {
          const actor = infMap[c.speaker] || primaryInf
          const rolePart = castRoles?.[actor.id] ? ` as ${castRoles[actor.id]}` : ''
          const bgmNote = c.bgm && BGM_VISUAL[c.bgm] ? ` [Audio: ${BGM_VISUAL[c.bgm]}]` : ''
          const anchorNote = c.consistency_anchor ? `[Visual anchor: ${c.consistency_anchor}]` : ''
          return {
            index: si + 1,
            prompt: [
              `${stylePrefix} Shot ${si + 1}:`,
              anchorNote, c.shot_description,
              c.dialogue ? `${actor.name}${rolePart} says: "${c.dialogue}"` : '',
              bgmNote,
            ].filter(Boolean).join(' '),
            duration: c.duration || 5,
          }
        }),
        shotType: 'customize' as const,
        totalDuration: groupDuration,
        aspectRatio: aspectRatio || '9:16',
        callbackUrl,
      }
    }
  }

  // Submit group 0 immediately; store groups 1..N as deferred
  const group0Payload = buildGroupPayload(groups[0], 0)
  const resp0 = await submitMultiShotVideo(
    group0Payload.kind === 'single'
      ? { imageUrl: group0Payload.imageUrl, prompt: group0Payload.prompt, shotType: group0Payload.shotType, totalDuration: group0Payload.totalDuration, aspectRatio: group0Payload.aspectRatio, callbackUrl }
      : { imageUrl: group0Payload.imageUrl, shots: group0Payload.shots, shotType: group0Payload.shotType, totalDuration: group0Payload.totalDuration, aspectRatio: group0Payload.aspectRatio, callbackUrl }
  )
  const result0 = classifyKlingResponse(resp0)
  if (result0.taskId) {
    await service.from('clips')
      .update({ status: 'submitted', provider: 'kling', task_id: result0.taskId, kling_task_id: result0.taskId })
      .eq('job_id', job.id).eq('clip_index', 0)
  } else {
    await failClipAndCheckJob(service, job.id, 0, result0.error ?? 'Submit failed')
  }

  // Store deferred payloads for groups 1..N in clips.prompt as JSON
  // The webhook reads these and submits them once the previous frame is available
  if (groups.length > 1) {
    await Promise.allSettled(groups.slice(1).map(async (group, i) => {
      const gi = i + 1
      const payload = buildGroupPayload(group, gi)
      await service.from('clips')
        .update({ prompt: JSON.stringify({ _deferred: true, ...payload }) })
        .eq('job_id', job.id).eq('clip_index', gi)
    }))
  }

  return NextResponse.json({ jobId: job.id })
}
