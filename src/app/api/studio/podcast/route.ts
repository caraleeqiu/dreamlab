import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildClipPrompt, submitImage2Video, submitMultiShotVideo } from '@/lib/kling'
import { classifyKlingResponse } from '@/lib/video-router'
import { groupClips } from '@/lib/video-utils'
import { getPresignedUrl } from '@/lib/r2'
import { CREDIT_COSTS, getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits, createClipRecords, failClipAndCheckJob } from '@/lib/job-service'
import type { ScriptClip, Influencer } from '@/types'

// POST /api/studio/podcast — 提交播客生成任务
// body: { topics, keypoints, perspective?, format, platform, aspect_ratio, duration_s, influencer_ids, script, language }
//
// 单主持人：groupClips() → submitMultiShotVideo（批量，节省 Kling API 调用）
// 双主持人：每 clip 单独 submitImage2Video（不同主持人图片，无法共用同一 base image）
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const body = await request.json()
  const { topics, keypoints, perspective, format, platform, aspect_ratio, duration_s, influencer_ids, script, language } = body

  if (!influencer_ids?.length || !script?.length || !platform || !aspect_ratio || !topics?.length) {
    return apiError('Missing required fields', 400)
  }

  const service = await createServiceClient()
  const creditError = await deductCredits(service, user.id, CREDIT_COSTS.podcast, 'podcast', language)
  if (creditError) return creditError

  const { data: influencers } = await supabase
    .from('influencers')
    .select('*')
    .in('id', influencer_ids)
  const infMap = Object.fromEntries((influencers || []).map((i: Influencer) => [i.id, i]))
  const slugMap = Object.fromEntries((influencers || []).map((i: Influencer) => [i.slug, i]))

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      user_id: user.id,
      type: 'podcast',
      status: 'scripting',
      language,
      title: topics.map((t: { title: string }) => t.title).join(' × '),
      platform,
      aspect_ratio,
      duration_s,
      influencer_ids,
      script,
      credit_cost: CREDIT_COSTS.podcast,
    })
    .select()
    .single()

  if (jobError || !job) {
    await service.rpc('add_credits', {
      p_user_id: user.id,
      p_amount: CREDIT_COSTS.podcast,
      p_reason: `refund:job_create_failed`,
    })
    return apiError(jobError?.message ?? (language === 'en' ? 'Failed to create job' : '创建任务失败'), 500)
  }

  await supabase.from('jobs').update({ status: 'generating' }).eq('id', job.id)

  const clips = script as ScriptClip[]
  const callbackUrl = getCallbackUrl()
  const isTwoHost = (influencer_ids as string[]).length > 1

  if (isTwoHost) {
    // ── 双主持人：不同 speaker 用不同图片，无法共用 base image，每 clip 单独提交 ──
    await createClipRecords(service, job.id, clips)

    await Promise.allSettled(clips.map(async (clip) => {
      const inf = slugMap[clip.speaker] ?? infMap[influencer_ids[0]]
      if (!inf) return

      const frontalKey = inf.frontal_image_url?.split('/dreamlab-assets/')[1]
      const presigned = frontalKey ? await getPresignedUrl(frontalKey) : inf.frontal_image_url || ''

      const payload = {
        ...buildClipPrompt(clip, inf, presigned, presigned),
        aspect_ratio,
        callback_url: callbackUrl,
      }

      const resp = await submitImage2Video(payload)
      const result = classifyKlingResponse(resp)
      if (result.taskId) {
        await service.from('clips')
          .update({ status: 'submitted', kling_task_id: result.taskId, prompt: payload.prompt })
          .eq('job_id', job.id).eq('clip_index', clip.index)
      } else {
        await failClipAndCheckJob(service, job.id, clip.index, result.error ?? 'Submit failed')
      }
    }))

  } else {
    // ── 单主持人：groupClips() 分批 → submitMultiShotVideo（≤6 shots / ≤15s 每批）──
    const inf = infMap[influencer_ids[0]] as Influencer
    if (!inf) return apiError('Influencer not found', 404)

    const frontalKey = inf.frontal_image_url?.split('/dreamlab-assets/')[1]
    const imageUrl = frontalKey ? await getPresignedUrl(frontalKey) : inf.frontal_image_url || ''
    const stylePrefix = `${inf.name} (${inf.tagline}). Voice: ${inf.voice_prompt}.`

    const groups = groupClips(clips)

    // clip_index tracks group index (matches anime/edu pattern)
    const clipInserts = groups.map((_, gi) => ({
      job_id: job.id, clip_index: gi, status: 'pending', prompt: '',
    }))
    await service.from('clips').insert(clipInserts)

    await Promise.allSettled(groups.map(async (group, gi) => {
      const groupDuration = group.reduce((s, c) => s + (c.duration || 15), 0)

      let resp
      if (group.length === 1) {
        const c = group[0]
        const cameraTag = [c.shot_type, c.camera_movement].filter(Boolean).join(', ')
        const prompt = [
          stylePrefix,
          cameraTag ? `[${cameraTag}]` : '',
          `Scene: ${c.shot_description}`,
          c.dialogue ? `${inf.name} says: "${c.dialogue}"` : '',
          'Podcast talking head, professional studio.',
        ].filter(Boolean).join(' ')

        resp = await submitMultiShotVideo({
          imageUrl,
          prompt,
          shotType: 'intelligence',
          totalDuration: groupDuration,
          aspectRatio: aspect_ratio || '9:16',
          callbackUrl,
        })
      } else {
        resp = await submitMultiShotVideo({
          imageUrl,
          shots: group.map((c, si) => {
            const cameraTag = [c.shot_type, c.camera_movement].filter(Boolean).join(', ')
            return {
              index: si + 1,
              prompt: [
                `${stylePrefix} Shot ${si + 1}:`,
                cameraTag ? `[${cameraTag}]` : '',
                c.shot_description,
                c.dialogue ? `${inf.name} says: "${c.dialogue}"` : '',
              ].filter(Boolean).join(' '),
              duration: c.duration || 15,
            }
          }),
          shotType: 'customize',
          totalDuration: groupDuration,
          aspectRatio: aspect_ratio || '9:16',
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
  }

  return NextResponse.json({ job_id: job.id }, { status: 201 })
}
