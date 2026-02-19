import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  // Get all story jobs with series_name, grouped
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, series_name, episode_number, status, created_at, final_video_url')
    .eq('user_id', user.id)
    .eq('type', 'story')
    .not('series_name', 'is', null)
    .order('created_at', { ascending: false })

  // Group by series_name
  type JobRow = {
    id: number
    title: string | null
    series_name: string | null
    episode_number: number | null
    status: string
    created_at: string
    final_video_url: string | null
  }
  const seriesMap: Record<string, { name: string; episodes: JobRow[]; latestStatus: string }> = {}
  for (const job of (jobs || []) as JobRow[]) {
    if (!job.series_name) continue
    if (!seriesMap[job.series_name]) {
      seriesMap[job.series_name] = { name: job.series_name, episodes: [], latestStatus: job.status }
    }
    seriesMap[job.series_name].episodes.push(job)
  }

  return NextResponse.json({ series: Object.values(seriesMap) })
}
