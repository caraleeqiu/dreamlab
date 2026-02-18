import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/jobs/[id] — 任务详情 + 切片列表
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !job) return NextResponse.json({ error: '任务不存在' }, { status: 404 })

  const { data: clips } = await supabase
    .from('clips')
    .select('*')
    .eq('job_id', id)
    .order('clip_index')

  return NextResponse.json({ ...job, clips })
}

// PATCH /api/jobs/[id] — 更新标题
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title } = body

  const { data, error } = await supabase
    .from('jobs')
    .update({ title })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/jobs/[id]
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
