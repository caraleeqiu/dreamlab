import { createClient } from '@/lib/supabase/server'
import AnimeWizard from './anime-wizard'
import type { Language } from '@/types'

export default async function AnimePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [profileRes, influencersRes] = await Promise.all([
    supabase.from('profiles').select('language, credits').eq('id', user!.id).single(),
    // Anime prefers virtual/brand influencers but shows all
    supabase.from('influencers').select('*').or(`is_builtin.eq.true,user_id.eq.${user!.id}`).order('is_builtin', { ascending: false }),
  ])

  return (
    <AnimeWizard
      lang={(profileRes.data?.language ?? 'zh') as Language}
      credits={profileRes.data?.credits ?? 0}
      influencers={influencersRes.data ?? []}
    />
  )
}
