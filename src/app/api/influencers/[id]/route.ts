import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// PUT /api/influencers/[id] — 修改文字信息（免费）
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // 只允许修改自己的非内置网红
  const { data, error } = await supabase
    .from('influencers')
    .update({
      name: body.name,
      tagline: body.tagline,
      personality: body.personality,
      domains: body.domains,
      speaking_style: body.speaking_style,
      catchphrases: body.catchphrases,
      chat_style: body.chat_style,
      forbidden: body.forbidden,
      voice_prompt: body.voice_prompt,
      ...(body.frontal_image_url && { frontal_image_url: body.frontal_image_url }),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('is_builtin', false)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '无权限或网红不存在' }, { status: 404 })
  return NextResponse.json(data)
}

// DELETE /api/influencers/[id]
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('influencers')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('is_builtin', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
