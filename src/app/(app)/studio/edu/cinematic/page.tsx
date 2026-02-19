import { createClient } from '@/lib/supabase/server'
import EduCinematicWizard from './edu-cinematic-wizard'
import type { Language } from '@/types'

export default async function EduCinematicPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('language, credits').eq('id', user!.id).single()

  return (
    <EduCinematicWizard
      lang={(profile?.language ?? 'zh') as Language}
      credits={profile?.credits ?? 0}
    />
  )
}
