import { createClient } from '@/lib/supabase/server'
import EduTalkWizard from './edu-talk-wizard'
import type { Language } from '@/types'

export default async function EduTalkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [profileRes, influencersRes] = await Promise.all([
    supabase.from('profiles').select('language, credits').eq('id', user!.id).single(),
    supabase.from('influencers').select('*').or(`is_builtin.eq.true,user_id.eq.${user!.id}`).order('is_builtin', { ascending: false }),
  ])

  return (
    <EduTalkWizard
      lang={(profileRes.data?.language ?? 'zh') as Language}
      credits={profileRes.data?.credits ?? 0}
      influencers={influencersRes.data ?? []}
    />
  )
}
