import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/user/preferences
// body: { module: string, prefs: Record<string, unknown> }
// Deep-merges the given module prefs into preferences JSONB column.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { module, prefs } = await request.json()
  if (!module || typeof prefs !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Use jsonb_set via RPC isn't necessary — merge at the top-level module key
  // Read existing, merge, write back (safe for low-frequency writes)
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .single()

  const existing = (profile?.preferences as Record<string, unknown>) ?? {}
  const updated  = { ...existing, [module]: { ...(existing[module] as object ?? {}), ...prefs } }

  const { error } = await supabase
    .from('profiles')
    .update({ preferences: updated })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
