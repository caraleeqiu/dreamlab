import { createClient } from '@/lib/supabase/server'
import RemixWizard from './remix-wizard'
import type { Language } from '@/types'

export default async function RemixPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [profileRes, influencersRes] = await Promise.all([
    supabase.from('profiles').select('language, credits').eq('id', user!.id).single(),
    supabase.from('influencers').select('*').or(`is_builtin.eq.true,user_id.eq.${user!.id}`).order('is_builtin', { ascending: false }),
  ])

  return (
    <RemixWizard
      lang={(profileRes.data?.language ?? 'zh') as Language}
      credits={profileRes.data?.credits ?? 0}
      influencers={influencersRes.data ?? []}
    />
  )
}
