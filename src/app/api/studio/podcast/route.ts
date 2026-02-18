import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildClipPrompt, submitImage2Video } from '@/lib/kling'
import { getPresignedUrl } from '@/lib/r2'
import type { ScriptClip, Influencer } from '@/types'

const CREDIT_COST = 20
const CALLBACK_BASE = process.env.NEXT_PUBLIC_APP_URL

// POST /api/studio/podcast — 提交播客生成任务
// body: { topics, keypoints, perspective?, format, platform, aspect_ratio, duration_s, influencer_ids, script, language }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { topics, keypoints, perspective, format, platform, aspect_ratio, duration_s, influencer_ids, script, language } = body

  // 1. 扣积分
  const service = await createServiceClient()
  const { error: deductError } = await service.rpc('deduct_credits', {
    p_user_id: user.id,
    p_amount: CREDIT_COST,
    p_reason: 'podcast',
  })
  if (deductError?.message.includes('insufficient_credits')) {
    return NextResponse.json({ error: '积分不足（需要 20 积分）' }, { status: 402 })
  }

  // 2. 拉取网红数据
  const { data: influencers } = await supabase
    .from('influencers')
    .select('*')
    .in('id', influencer_ids)
  const infMap = Object.fromEntries((influencers || []).map((i: Influencer) => [i.id, i]))
  // slug → influencer（对话播客按 clip.speaker 选对应网红的图）
  const slugMap = Object.fromEntries((influencers || []).map((i: Influencer) => [i.slug, i]))

  // 3. 创建 Job
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
      credit_cost: CREDIT_COST,
    })
    .select()
    .single()

  if (jobError || !job) return NextResponse.json({ error: jobError?.message }, { status: 500 })

  // 4. 并发提交所有切片到 Kling
  await supabase.from('jobs').update({ status: 'generating' }).eq('id', job.id)

  const clipInserts = (script as ScriptClip[]).map(clip => ({
    job_id: job.id,
    clip_index: clip.index,
    status: 'pending',
    prompt: '',
  }))
  const { data: clips } = await service.from('clips').insert(clipInserts).select()

  // 并发提交 Kling
  const klingPromises = (script as ScriptClip[]).map(async (clip, i) => {
    // 对话播客：根据 clip.speaker (slug) 选对应网红，fallback 到第一个
    const inf = slugMap[clip.speaker] ?? infMap[influencer_ids[0]]
    if (!inf) return

    // 用网红正面图的 presigned URL
    const frontalKey = inf.frontal_image_url?.split('/dreamlab-assets/')[1]
    const frontalPresigned = frontalKey ? await getPresignedUrl(frontalKey) : inf.frontal_image_url || ''

    // 首帧图（暂用同一张，后续可以按平台生成专用首帧）
    const firstFramePresigned = frontalPresigned

    const payload = {
      ...buildClipPrompt(clip, inf, firstFramePresigned, frontalPresigned),
      aspect_ratio,
      callback_url: `${CALLBACK_BASE}/api/webhooks/kling`,
    }

    const resp = await submitImage2Video(payload)
    const taskId = resp?.data?.task_id

    if (taskId && clips) {
      await service.from('clips')
        .update({ status: 'submitted', kling_task_id: taskId, prompt: payload.prompt })
        .eq('job_id', job.id)
        .eq('clip_index', clip.index)
    }
  })

  await Promise.allSettled(klingPromises)

  return NextResponse.json({ job_id: job.id }, { status: 201 })
}
