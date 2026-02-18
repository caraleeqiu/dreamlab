import { createClient } from '@/lib/supabase/server'
import TrendingClient from './trending-client'
import { TOPIC_CATEGORIES } from '@/lib/language'
import type { Language } from '@/types'

export default async function TrendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('language').eq('id', user!.id).single()

  const lang = (profile?.language ?? 'zh') as Language
  const categories = TOPIC_CATEGORIES[lang]

  return <TrendingClient lang={lang} categories={categories} />
}
