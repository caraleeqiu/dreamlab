import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadToR2 } from '@/lib/r2'
import { apiError } from '@/lib/api-response'

// POST /api/influencers/upload-image
// FormData: { file: File, is_first?: string }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return apiError('No file provided', 400)

  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    return apiError('Only image files are allowed', 400)
  }

  // 验证文件大小（最大 5MB）
  if (file.size > 5 * 1024 * 1024) {
    return apiError('File too large (max 5MB)', 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() || 'png'

  // 检查 R2 是否配置完整
  const r2Configured = process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY

  if (r2Configured) {
    const key = `influencers/user-${user.id}/uploads/${Date.now()}.${ext}`
    const url = await uploadToR2(key, buffer, file.type)
    return NextResponse.json({ url })
  } else {
    // R2 未配置时返回 base64 data URL (临时方案)
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`
    return NextResponse.json({ url: dataUrl })
  }
}
