import { createClient } from '@/lib/supabase/server'
import StoryPageClient from './story-page-client'
import type { Language } from '@/types'

export default async function StoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [profileRes, influencersRes] = await Promise.all([
    supabase.from('profiles').select('language, credits, preferences').eq('id', user!.id).single(),
    supabase.from('influencers').select('*').or(`is_builtin.eq.true,user_id.eq.${user!.id}`).order('is_builtin', { ascending: false }),
  ])

  const prefs = (profileRes.data?.preferences as Record<string, unknown> | null) ?? {}
  return (
    <StoryPageClient
      lang={(profileRes.data?.language ?? 'zh') as Language}
      credits={profileRes.data?.credits ?? 0}
      influencers={influencersRes.data ?? []}
      initialPrefs={(prefs.story as Record<string, unknown>) ?? {}}
    />
  )
}
