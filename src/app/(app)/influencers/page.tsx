import { createClient } from '@/lib/supabase/server'
import InfluencersClient from './influencers-client'
import type { Language } from '@/types'

export default async function InfluencersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('language')
    .eq('id', user!.id)
    .single()

  return <InfluencersClient lang={(profile?.language ?? 'zh') as Language} />
}
