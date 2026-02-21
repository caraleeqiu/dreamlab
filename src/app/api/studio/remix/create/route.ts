import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitMultiShotVideo } from '@/lib/kling'
import { classifyKlingResponse } from '@/lib/video-router'
import { groupClips } from '@/lib/video-utils'
import { getPresignedUrl, uploadToR2 } from '@/lib/r2'
import { CREDIT_COSTS, getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits, failClipAndCheckJob } from '@/lib/job-service'
import type { RemixAnalysis, ScriptClip, Influencer, Language } from '@/types'

// POST /api/studio/remix/create
// Creates a video from a RemixAnalysis (scenario ③: script imitation)
// Mirrors the Story route's deferred chain pattern so >15s is handled automatically.
//
// Body: {
//   analysis: RemixAnalysis
//   influencerId: string
//   platform: string
//   aspectRatio?: string
//   referenceVideoUrl?: string   // original video — used for camera style reference
//   lang?: string
// }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { analysis, influencerId, platform, aspectRatio, referenceVideoUrl, lang } = await req.json() as {
    analysis: RemixAnalysis
    influencerId: string
    platform: string
    aspectRatio?: string
    referenceVideoUrl?: string
    lang?: string
  }

  if (!analysis?.remixScript?.length || !influencerId || !platform) {
    return apiError('Missing required fields', 400)
  }

  const { data: influencer } = await supabase
    .from('influencers').select('*').eq('id', influencerId).single()
  if (!influencer) return apiError('Influencer not found', 404)
  const inf = influencer as Influencer

  // Validate influencer has a frontal image
  if (!inf.frontal_image_url) {
    return apiError(
      lang === 'en'
        ? 'This influencer has no avatar image. Please set one first.'
        : '该网红没有设置头像图片，请先上传头像。',
      400
    )
  }

  const service = await createServiceClient()
  const creditError = await deductCredits(service, user.id, CREDIT_COSTS.remix, `remix-create: ${analysis.narrative.hookType}`, (lang || 'zh') as Language)
  if (creditError) return creditError

  // Resolve influencer image
  const frontalKey = inf.frontal_image_url!.split('/dreamlab-assets/')[1]
  const imageUrl = frontalKey ? await getPresignedUrl(frontalKey) : inf.frontal_image_url!

  // Subject Library: only use element_id if registered (Kling API doesn't support frontal_image_url fallback)
  const elementList = inf.kling_element_id
    ? [{ element_id: inf.kling_element_id }]
    : undefined
  const voiceList = inf.kling_element_voice_id
    ? [{ voice_id: inf.kling_element_voice_id }]
    : undefined

  // Replace placeholder slug in remixScript with the actual influencer slug
  const script: ScriptClip[] = analysis.remixScript.map((c, i) => ({
    ...c,
    index: i,
    speaker: inf.slug,
  }))

  // Mirror reference video to R2 for camera-style learning (feature mode)
  let mirroredRefUrl: string | undefined
  if (referenceVideoUrl) {
    try {
      const r = await fetch(referenceVideoUrl, { signal: AbortSignal.timeout(15_000) })
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer())
        mirroredRefUrl = await uploadToR2(`remix-refs/analyze-${Date.now()}.mp4`, buf, 'video/mp4')
      }
    } catch { /* non-fatal */ }
  }

  // Create job
  const { data: job, error: jobErr } = await supabase.from('jobs').insert({
    user_id: user.id, type: 'remix', status: 'generating', language: lang || 'zh',
    title: lang === 'en' ? `Script Imitation: ${analysis.narrative.hookType} · ${analysis.narrative.platformStyle}` : `脚本仿写: ${analysis.narrative.hookType} · ${analysis.narrative.platformStyle}`,
    platform, aspect_ratio: aspectRatio || '9:16',
    influencer_ids: [influencerId], script, credit_cost: CREDIT_COSTS.remix,
    metadata: { remixMode: 'script-imitation', referenceVideoUrl: mirroredRefUrl, styleGuide: analysis.styleGuide },
  }).select().single()

  if (jobErr) {
    await service.rpc('add_credits', { p_user_id: user.id, p_amount: CREDIT_COSTS.remix, p_reason: 'refund:job_create_failed' })
    return apiError(jobErr.message, 500)
  }

  const callbackUrl = getCallbackUrl()
  const groups = groupClips(script)

  // Insert one clip record per group
  await service.from('clips').insert(groups.map((_, gi) => ({
    job_id: job.id, clip_index: gi, status: 'pending', prompt: '', provider: 'kling',
  })))

  const MOTION_SUFFIX = 'natural micro-movements while speaking, subtle hand gestures, realistic breathing, gentle environmental motion'
  const styleNote = [
    analysis.styleGuide.visualStyle,
    `${inf.name} (${inf.tagline}). Voice: ${inf.voice_prompt}.`,
  ].filter(Boolean).join(' ')

  // Build per-group Kling params — same deferred chain pattern as Story
  function buildGroupPayload(group: ScriptClip[], gi: number) {
    const groupDuration = Math.min(group.reduce((s, c) => s + (c.duration || 15), 0), 15)
    const base = {
      imageUrl,
      totalDuration: groupDuration,
      aspectRatio: aspectRatio || '9:16',
      callbackUrl,
      elementList,
      voiceList,
      referenceVideoUrl: mirroredRefUrl,  // camera style learning from original
    }
    if (group.length === 1) {
      const c = group[0]
      const anchorNote = c.consistency_anchor ? `[Visual anchor: ${c.consistency_anchor}]` : ''
      const sceneNote = c.scene_anchor ? `[Scene anchor: ${c.scene_anchor}]` : ''
      return {
        kind: 'single' as const,
        ...base,
        prompt: [styleNote, anchorNote, sceneNote, `Scene: ${c.shot_description}.`, c.dialogue ? `${inf.name} says: "${c.dialogue}"` : '', MOTION_SUFFIX].filter(Boolean).join(' '),
        shotType: 'intelligence' as const,
      }
    } else {
      return {
        kind: 'multi' as const,
        ...base,
        shots: group.map((c, si) => ({
          index: si + 1,
          prompt: [styleNote, c.consistency_anchor ? `[Visual anchor: ${c.consistency_anchor}]` : '', c.scene_anchor ? `[Scene anchor: ${c.scene_anchor}]` : '', c.shot_description, c.dialogue ? `${inf.name} says: "${c.dialogue}"` : '', MOTION_SUFFIX].filter(Boolean).join(' '),
          duration: c.duration || 15,
        })),
        shotType: 'customize' as const,
      }
    }
  }

  // Submit group 0 immediately
  const g0 = buildGroupPayload(groups[0], 0)
  const resp0 = await submitMultiShotVideo(
    g0.kind === 'single'
      ? { imageUrl: g0.imageUrl, prompt: g0.prompt, shotType: g0.shotType, totalDuration: g0.totalDuration, aspectRatio: g0.aspectRatio, elementList: g0.elementList, voiceList: g0.voiceList, referenceVideoUrl: g0.referenceVideoUrl, callbackUrl }
      : { imageUrl: g0.imageUrl, shots: g0.shots, shotType: g0.shotType, totalDuration: g0.totalDuration, aspectRatio: g0.aspectRatio, elementList: g0.elementList, voiceList: g0.voiceList, referenceVideoUrl: g0.referenceVideoUrl, callbackUrl }
  )
  const r0 = classifyKlingResponse(resp0)
  if (r0.taskId) {
    await service.from('clips')
      .update({ status: 'submitted', provider: 'kling', kling_task_id: r0.taskId, task_id: r0.taskId })
      .eq('job_id', job.id).eq('clip_index', 0)
  } else {
    await failClipAndCheckJob(service, job.id, 0, r0.error ?? 'Submit failed')
  }

  // Store groups 1..N as deferred (frame chaining via webhook)
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
