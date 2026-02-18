import { createClient } from '@/lib/supabase/server'
import PodcastClient from './podcast-home'
import type { Language } from '@/types'

export default async function PodcastPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, influencersRes, jobsRes] = await Promise.all([
    supabase.from('profiles').select('language, credits').eq('id', user!.id).single(),
    supabase.from('influencers').select('*').or(`is_builtin.eq.true,user_id.eq.${user!.id}`).order('is_builtin', { ascending: false }),
    supabase.from('jobs').select('*')
      .eq('user_id', user!.id).eq('type', 'podcast')
      .order('created_at', { ascending: false }).limit(5),
  ])

  return (
    <PodcastClient
      lang={(profileRes.data?.language ?? 'zh') as Language}
      credits={profileRes.data?.credits ?? 0}
      influencers={influencersRes.data ?? []}
      recentJobs={jobsRes.data ?? []}
    />
  )
}
