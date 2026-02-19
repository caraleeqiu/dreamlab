import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'

// GET /api/jobs/stream — SSE 推送进行中的任务列表
// 每 4s 推送一次活跃任务，全部完成/失败后关闭连接
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const encoder = new TextEncoder()
  const MAX_TICKS = 75  // 最长 5 分钟（75 × 4s）
  const INTERVAL_MS = 4000

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

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
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id, type, status, title, platform, credit_cost, created_at, aspect_ratio')
          .eq('user_id', user.id)
          .not('status', 'in', '("done","failed")')
          .order('created_at', { ascending: false })
          .limit(20)

        const activeJobs = jobs ?? []
        send(activeJobs)

        // 没有活跃任务时关闭连接（前端会显示空列表）
        if (activeJobs.length === 0) break

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
      'X-Accel-Buffering': 'no',
    },
  })
}
