import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitSimpleVideo, submitOmniVideo, submitVideoToVideo } from '@/lib/kling'
import { classifyKlingResponse } from '@/lib/video-router'
import { getPresignedUrl, uploadToR2 } from '@/lib/r2'
import { CREDIT_COSTS, getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits, createClipRecords, failClipAndCheckJob } from '@/lib/job-service'
import { callGeminiJson } from '@/lib/gemini'
import type { Influencer } from '@/types'

const REMIX_STYLE_LABELS: Record<string, string> = {
  commentary: '网红解说', reaction: '反应视频', duet: '合拍二创', remake: '同款翻拍',
}

const REMIX_STYLE_EN: Record<string, string> = {
  commentary: 'commentary style — react and explain in your own voice',
  reaction:   'reaction video — show genuine surprise/emotion while watching',
  duet:       'duet collab — respond side-by-side, match the original energy',
  remake:     'faithful recreation — same vibe, same beats, your personality',
}

// Download a video URL and mirror to R2 so Kling can access it without expiry.
// Returns the R2 public URL, or null if download fails (caller falls back gracefully).
async function mirrorVideoToR2(videoUrl: string, jobId: number): Promise<string | null> {
  try {
    const res = await fetch(videoUrl, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    return await uploadToR2(`remix-refs/job-${jobId}.mp4`, buffer, 'video/mp4')
  } catch {
    return null
  }
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
  const creditError = await deductCredits(service, user.id, CREDIT_COSTS.remix, `remix: ${videoTitle || videoUrl.slice(0, 40)}`, lang || 'zh')
  if (creditError) return creditError

  // Generate script via Gemini
  type RemixClip = { index: number; speaker: string; dialogue: string; shot_description: string; duration: number }
  let script: RemixClip[] = []
  try {
    const styleDesc = REMIX_STYLE_EN[remixStyle] || 'remix'
    const userPrompt = `You are ${influencer.name}, ${influencer.tagline}.
Speaking style: ${influencer.speaking_style || 'natural and energetic'}

Create a "${REMIX_STYLE_LABELS[remixStyle] || '二创'}" (${styleDesc}) of this video:
Video: ${videoUrl}
Title: ${videoTitle || ''}

Generate a ${platform} vertical short video script (~30s, 3-4 clips) in your style.
${lang === 'en' ? 'Write all dialogue in English.' : '所有台词用中文写。'}

Return JSON: [{"index":0,"speaker":"${influencer.slug}","dialogue":"line","shot_description":"shot desc","duration":8}]`

    script = await callGeminiJson<RemixClip[]>({
      systemPrompt: `You are ${influencer.name}, ${influencer.tagline}.`,
      userPrompt,
    })
  } catch {
    script = [{ index: 0, speaker: influencer.slug, dialogue: lang === 'en' ? `Let me break this down for you.` : `来看这个视频，我来解读一下。`, shot_description: 'Medium shot, influencer facing camera, studio background', duration: 10 }]
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

  await createClipRecords(service, job.id, script)

  // Get presigned URL for influencer image
  const frontalKey = inf.frontal_image_url?.split('/dreamlab-assets/')[1]
  const imageUrl = frontalKey ? await getPresignedUrl(frontalKey) : inf.frontal_image_url!

  const styleDesc = REMIX_STYLE_EN[remixStyle as string] || ''
  const callbackUrl = getCallbackUrl()

  // Mirror reference video to R2 if influencer supports reference-to-video
  // Only attempt if influencer has a Subject Library element registered
  const referenceVideoUrl = inf.kling_element_id ? await mirrorVideoToR2(videoUrl, job.id) : null

  await Promise.allSettled(script.map(async (clip) => {
    let resp

    if (inf.kling_element_id && referenceVideoUrl) {
      // ── Tier 1: Omni video-to-video (feature mode) ───────────────────────────
      // Inherits the framing/motion energy of the source video while replacing
      // the character with the influencer. "feature" = cinematic style reference.
      const prompt = [
        `${clip.shot_description}.`,
        `${inf.name} says: "${clip.dialogue}"`,
        `[VOICE: ${inf.voice_prompt}]`,
        styleDesc,
      ].filter(Boolean).join(' ')

      resp = await submitVideoToVideo({
        prompt,
        imageUrl,
        referenceVideoUrl,
        referType: 'feature',
        keepOriginalSound: false,
        elementId: inf.kling_element_id,
        voiceId: inf.kling_element_voice_id ?? undefined,
        totalDuration: clip.duration,
        aspectRatio: aspectRatio || '9:16',
        callbackUrl,
      })

    } else if (inf.kling_element_id) {
      // ── Tier 2: Omni without reference (character + voice consistency) ───────
      const prompt = [
        `${clip.shot_description}.`,
        `${inf.name} says: "${clip.dialogue}"`,
        `[VOICE: ${inf.voice_prompt}]`,
        styleDesc,
      ].filter(Boolean).join(' ')

      resp = await submitOmniVideo({
        prompt,
        imageUrl,
        elementId: inf.kling_element_id,
        voiceId: inf.kling_element_voice_id ?? undefined,
        totalDuration: clip.duration,
        shotType: 'intelligence',
        aspectRatio: aspectRatio || '9:16',
        callbackUrl,
      })

    } else {
      // ── Tier 3: Simple image2video fallback ──────────────────────────────────
      const prompt = `${clip.shot_description}. ${inf.name}: ${inf.speaking_style || 'energetic'}. [VOICE: ${inf.voice_prompt}]. "${clip.dialogue}". ${styleDesc}`
      resp = await submitSimpleVideo({
        prompt,
        imageUrl,
        durationS: clip.duration,
        aspectRatio: aspectRatio || '9:16',
        callbackUrl,
      })
    }

    const result = classifyKlingResponse(resp)
    if (result.taskId) {
      await service.from('clips')
        .update({ status: 'submitted', kling_task_id: result.taskId, prompt: clip.shot_description })
        .eq('job_id', job.id).eq('clip_index', clip.index)
    } else {
      await failClipAndCheckJob(service, job.id, clip.index, result.error ?? 'Submit failed')
    }
  }))

  return NextResponse.json({ jobId: job.id })
}
