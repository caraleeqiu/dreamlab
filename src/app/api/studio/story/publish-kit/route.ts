import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { jobId } = await req.json()
  if (!jobId) return apiError('Missing jobId', 400)

  const { data: job } = await supabase
    .from('jobs').select('title, script, platform, aspect_ratio, language').eq('id', jobId).eq('user_id', user.id).single()
  if (!job) return apiError('Job not found', 404)

  const lang = job.language || 'zh'
  const scriptSummary = Array.isArray(job.script)
    ? job.script.map((c: { dialogue?: string; shot_description?: string }, i: number) =>
        `Scene ${i + 1}: ${c.dialogue || c.shot_description || ''}`
      ).join('\n')
    : ''

  const prompt = lang === 'zh'
    ? `你是一位TikTok短剧运营专家，专注悬疑类竖屏短剧。
根据以下短剧信息，生成一套完整的发布包。

【短剧标题】${job.title || '无标题'}
【发布平台】${job.platform || 'TikTok'}
【剧本摘要】
${scriptSummary}

请生成：
1. caption（正文）：100字以内，结尾必须有一个引发讨论的悬疑问句，让观众在评论区发表理论
2. hashtags：5-8个相关话题标签（#开头，空格分隔）
3. bestPostTime：最佳发布时间建议（具体到星期几+几点）
4. hookAdvice：一句话说明这个视频的最强吸引点是什么，应该怎么在发布后第一时间推给算法

以JSON格式返回：{"caption": "...", "hashtags": "...", "bestPostTime": "...", "hookAdvice": "..."}`
    : `You are a TikTok short drama marketing expert specializing in mystery vertical content.
Based on the following drama info, generate a complete publish kit.

Title: ${job.title || 'Untitled'}
Platform: ${job.platform || 'TikTok'}
Script summary:
${scriptSummary}

Generate:
1. caption: Under 100 words, must end with a mystery question that drives comment theories
2. hashtags: 5-8 relevant hashtags (starting with #, space separated)
3. bestPostTime: Best time to post (specific day + hour)
4. hookAdvice: One sentence on the strongest hook and how to maximize algorithm reach in the first hour

Return as JSON: {"caption": "...", "hashtags": "...", "bestPostTime": "...", "hookAdvice": "..."}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
        }),
      }
    )
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const kit = JSON.parse(text)
    return NextResponse.json(kit)
  } catch (e: unknown) {
    console.error('Publish kit error:', e)
    return apiError('Publish kit generation failed', 500)
  }
}
