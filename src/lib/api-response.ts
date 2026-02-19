import { NextResponse } from 'next/server'

/**
 * 统一错误响应格式：{ error: string }
 * 替代各 route 中散落的 NextResponse.json({ error: ... }, { status: ... })
 */
export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}
