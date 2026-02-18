import { createClient } from '@/lib/supabase/server'
import CreditsClient from './credits-client'

export default async function CreditsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, txRes] = await Promise.all([
    supabase.from('profiles').select('credits, display_name').eq('id', user!.id).single(),
    supabase.from('credit_transactions')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <CreditsClient
      credits={profileRes.data?.credits ?? 0}
      transactions={txRes.data ?? []}
    />
  )
}
