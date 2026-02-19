import { createClient } from '@/lib/supabase/server'
import RemixWizard from './remix-wizard'
import type { Language, Job } from '@/types'

export default async function RemixPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [profileRes, influencersRes, jobsRes] = await Promise.all([
    supabase.from('profiles').select('language, credits').eq('id', user!.id).single(),
    supabase.from('influencers').select('*').or(`is_builtin.eq.true,user_id.eq.${user!.id}`).order('is_builtin', { ascending: false }),
    supabase.from('jobs').select('id, title, type, status, aspect_ratio, final_video_url, created_at')
      .eq('user_id', user!.id)
      .not('final_video_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <RemixWizard
      lang={(profileRes.data?.language ?? 'zh') as Language}
      credits={profileRes.data?.credits ?? 0}
      influencers={influencersRes.data ?? []}
      jobs={(jobsRes.data ?? []) as unknown as Job[]}
    />
  )
}
