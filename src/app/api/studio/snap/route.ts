/**
 * POST /api/studio/snap
 *
 * AI Visual Tutor - Creative Storyteller Entry
 *
 * Flow:
 * 1. Receive image (base64 or URL) + question
 * 2. Gemini Vision analyzes image + generates educational script
 * 3. Auto-match suitable influencer based on content
 * 4. Submit to Kling for video generation
 * 5. Return job ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submitMultiShotVideo } from '@/lib/kling'
import { classifyKlingResponse } from '@/lib/video-router'
import { groupClips } from '@/lib/video-utils'
import { getPresignedUrl, uploadBase64ToR2 } from '@/lib/r2'
import { CREDIT_COSTS, getCallbackUrl } from '@/lib/config'
import { apiError } from '@/lib/api-response'
import { deductCredits, failClipAndCheckJob } from '@/lib/job-service'
import { callGeminiVision } from '@/lib/gemini'
import type { ScriptClip } from '@/types'

export const maxDuration = 120

// Micro-motion suffix for natural video
const MOTION_SUFFIX = 'natural micro-movements while speaking, subtle hand gestures, realistic breathing, gentle environmental motion'

// Content category to influencer mapping
const CATEGORY_INFLUENCER_MAP: Record<string, string[]> = {
  science: ['science', 'tech'],      // 科学/物理/化学
  nature: ['nature', 'cute'],        // 自然/动植物
  tech: ['tech', 'science'],         // 技术/电子
  art: ['creative', 'cute'],         // 艺术/设计
  daily: ['cute', 'friendly'],       // 日常生活
  food: ['cute', 'friendly'],        // 食物/烹饪
  math: ['science', 'tech'],         // 数学
  history: ['professional', 'wise'], // 历史/文化
}

interface SnapRequest {
  imageData?: string       // base64 encoded image
  imageUrl?: string        // or direct URL
  question: string
  style?: 'cute' | 'professional' | 'fun'
  duration?: 15 | 30 | 60
  lang?: 'zh' | 'en'
}

interface VisionAnalysis {
  topic: string
  category: string
  keyPoints: string[]
  explanation: string
  suggestedStyle: 'cute' | 'professional' | 'fun'
}

interface GeneratedScript {
  title: string
  clips: Array<{
    duration: number
    shot_description: string
    dialogue: string
  }>
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const body: SnapRequest = await req.json()
  const { imageData, imageUrl, question, style, duration = 30, lang = 'zh' } = body

  // Validate input
  if (!imageData && !imageUrl) {
    return apiError(lang === 'zh' ? '请提供图片' : 'Image required', 400)
  }
  if (!question) {
    return apiError(lang === 'zh' ? '请提供问题' : 'Question required', 400)
  }

  const service = await createServiceClient()

  try {
    // 1. Upload image if base64
    let finalImageUrl = imageUrl
    if (imageData) {
      const uploaded = await uploadBase64ToR2(imageData, `snap/${user.id}/${Date.now()}.jpg`)
      finalImageUrl = uploaded.url
    }

    if (!finalImageUrl) {
      return apiError('Failed to process image', 400)
    }

    // 2. Analyze image with Gemini Vision and generate script
    const imageBuffer = await fetchImageAsBuffer(finalImageUrl)

    const analysisPrompt = `You are an educational content creator. Analyze this image and answer the user's question.

User question: "${question}"

Return JSON with:
{
  "topic": "main topic/object in the image",
  "category": "one of: science, nature, tech, art, daily, food, math, history",
  "keyPoints": ["3-5 key educational points about this topic"],
  "explanation": "clear, engaging explanation suitable for a ${duration}s video (${lang === 'zh' ? 'in Chinese' : 'in English'})",
  "suggestedStyle": "cute, professional, or fun - based on topic"
}

Be educational, engaging, and accurate. ${lang === 'zh' ? 'Response in Chinese.' : 'Response in English.'}`

    const analysis = await callGeminiVision<VisionAnalysis>({
      textPrompt: analysisPrompt,
      imageBuffers: [imageBuffer],
    })

    // 3. Generate video script based on analysis
    const scriptPrompt = `Create a ${duration}s educational video script.

Topic: ${analysis.topic}
Key points: ${analysis.keyPoints.join(', ')}
Explanation: ${analysis.explanation}
Style: ${style || analysis.suggestedStyle}
Language: ${lang === 'zh' ? 'Chinese' : 'English'}

Return JSON:
{
  "title": "engaging video title",
  "clips": [
    {
      "duration": 5,
      "shot_description": "visual description for AI video generation",
      "dialogue": "what the presenter says"
    }
  ]
}

Rules:
- Total duration must be ${duration}s
- Each clip 3-5 seconds
- First clip: attention-grabbing hook
- Middle clips: explain key points
- Last clip: memorable takeaway
- Dialogue should be natural and engaging
${lang === 'zh' ? '- All dialogue in Chinese' : '- All dialogue in English'}`

    const scriptResult = await callGeminiVision<GeneratedScript>({
      textPrompt: scriptPrompt,
      imageBuffers: [imageBuffer],
    })

    // 4. Find matching influencer
    const category = analysis.category || 'daily'
    const preferredDomains = CATEGORY_INFLUENCER_MAP[category] || ['cute']

    const { data: influencers } = await supabase
      .from('influencers')
      .select('*')
      .or(`domains.cs.{${preferredDomains.join(',')}},type.eq.virtual`)
      .limit(5)

    // Pick first match or fallback
    const influencer = influencers?.[0] || (await supabase
      .from('influencers')
      .select('*')
      .eq('is_official', true)
      .limit(1)
      .single()
    ).data

    if (!influencer) {
      return apiError('No influencer available', 500)
    }

    // 5. Deduct credits
    const creditError = await deductCredits(
      service,
      user.id,
      CREDIT_COSTS.snap,
      `snap: ${analysis.topic}`,
      lang
    )
    if (creditError) return creditError

    // 6. Create job
    const { data: job, error: jobErr } = await supabase.from('jobs').insert({
      user_id: user.id,
      type: 'snap',
      status: 'generating',
      language: lang,
      title: scriptResult.title,
      platform: 'douyin',
      aspect_ratio: '9:16',
      influencer_ids: [influencer.id],
      duration_s: duration,
      script: scriptResult.clips,
      credit_cost: CREDIT_COSTS.snap,
      metadata: {
        source_image: finalImageUrl,
        question,
        analysis,
      },
    }).select().single()

    if (jobErr) {
      await service.rpc('add_credits', {
        p_user_id: user.id,
        p_amount: CREDIT_COSTS.snap,
        p_reason: 'refund:job_create_failed',
      })
      return apiError(jobErr.message, 500)
    }

    // 7. Submit to Kling
    const frontalKey = influencer.frontal_image_url?.split('/dreamlab-assets/')[1]
    const presignedImageUrl = frontalKey
      ? await getPresignedUrl(frontalKey)
      : influencer.frontal_image_url || ''

    const elementList = influencer.kling_element_id
      ? [{ element_id: influencer.kling_element_id }]
      : undefined
    const voiceList = influencer.kling_element_voice_id
      ? [{ voice_id: influencer.kling_element_voice_id }]
      : undefined

    const callbackUrl = getCallbackUrl()
    const clips = scriptResult.clips as ScriptClip[]
    const groups = groupClips(clips)

    const stylePrefix = `${influencer.name} (${influencer.tagline}), educational content creator. Voice: ${influencer.voice_prompt}.`

    // Insert clip records
    const clipInserts = groups.map((_, gi) => ({
      job_id: job.id,
      clip_index: gi,
      status: 'pending',
      prompt: '',
      provider: 'kling',
    }))
    await service.from('clips').insert(clipInserts)

    // Submit all groups to Kling
    await Promise.allSettled(groups.map(async (group, gi) => {
      const groupDuration = Math.min(group.reduce((s, c) => s + (c.duration || 5), 0), 15)

      let resp
      if (group.length === 1) {
        const c = group[0]
        const prompt = [
          stylePrefix,
          `Scene: ${c.shot_description}.`,
          c.dialogue ? `${influencer.name} explains: "${c.dialogue}"` : '',
          MOTION_SUFFIX,
          'Vertical format 9:16, educational quality.',
        ].filter(Boolean).join(' ')

        resp = await submitMultiShotVideo({
          imageUrl: presignedImageUrl,
          prompt,
          shotType: 'intelligence',
          totalDuration: groupDuration,
          aspectRatio: '9:16',
          elementList,
          voiceList,
          callbackUrl,
        })
      } else {
        resp = await submitMultiShotVideo({
          imageUrl: presignedImageUrl,
          shots: group.map((c, si) => ({
            index: si + 1,
            prompt: [
              `${stylePrefix} Shot ${si + 1}:`,
              c.shot_description,
              c.dialogue ? `${influencer.name} explains: "${c.dialogue}"` : '',
              MOTION_SUFFIX,
            ].filter(Boolean).join(' '),
            duration: c.duration || 5,
          })),
          shotType: 'customize',
          totalDuration: groupDuration,
          aspectRatio: '9:16',
          elementList,
          voiceList,
          callbackUrl,
        })
      }

      const result = classifyKlingResponse(resp)
      if (result.taskId) {
        await service.from('clips')
          .update({ status: 'submitted', provider: 'kling', kling_task_id: result.taskId, task_id: result.taskId })
          .eq('job_id', job.id).eq('clip_index', gi)
      } else {
        await failClipAndCheckJob(service, job.id, gi, result.error ?? 'Submit failed')
      }
    }))

    // 8. Return response with preview data
    return NextResponse.json({
      jobId: job.id,
      title: scriptResult.title,
      analysis: {
        topic: analysis.topic,
        category: analysis.category,
        keyPoints: analysis.keyPoints,
      },
      influencer: {
        id: influencer.id,
        name: influencer.name,
        avatarUrl: influencer.avatar_url,
      },
      script: scriptResult.clips,
    })

  } catch (error) {
    console.error('[snap] Error:', error)
    return apiError(
      lang === 'zh' ? '生成失败，请重试' : 'Generation failed, please retry',
      500
    )
  }
}

// Helper: Fetch image as buffer for Gemini Vision
async function fetchImageAsBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
