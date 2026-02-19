import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'

type Params = { params: Promise<{ id: string }> }

// GET /api/jobs/[id]/stream — Server-Sent Events 实时推送 job 状态
// 替代前端 10s 轮询，每 3s 推送一次，job 完成/失败后自动关闭连接
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  // 验证 job 归属
  const { data: jobCheck } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!jobCheck) return apiError('任务不存在', 404)

  const encoder = new TextEncoder()
  // 最长保持连接 5 分钟（300s / 3s = 100 次）
  const MAX_TICKS = 100
  const INTERVAL_MS = 3000

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      // 客户端断开时标记关闭
      request.signal.addEventListener('abort', () => {
        closed = true
        try { controller.close() } catch {}
      })

      const send = (payload: object) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        } catch {}
      }

      for (let tick = 0; tick < MAX_TICKS && !closed; tick++) {
        // 查询最新 job + clips 状态
        const [{ data: jobData }, { data: clips }] = await Promise.all([
          supabase
            .from('jobs')
            .select('status, final_video_url, error_msg, title, credit_cost, aspect_ratio')
            .eq('id', id)
            .single(),
          supabase
            .from('clips')
            .select('clip_index, status, video_url, lipsync_url')
            .eq('job_id', id)
            .order('clip_index'),
        ])

        send({ ...jobData, clips })

        // job 已完成或失败 → 关闭连接
        if (jobData?.status === 'done' || jobData?.status === 'failed') break

        // 等待下一次推送
        await new Promise<void>(resolve => setTimeout(resolve, INTERVAL_MS))
      }

      if (!closed) {
        try { controller.close() } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲，确保实时推送
    },
  })
}
