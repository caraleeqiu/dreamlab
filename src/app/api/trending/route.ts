import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readFileSync } from 'fs'
import { join } from 'path'

// GET /api/trending?lang=zh&category=科技
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const lang = searchParams.get('lang') || 'zh'
  const category = searchParams.get('category') || (lang === 'zh' ? '科技' : 'Tech')

  try {
    // 读取本地缓存文件（由 scripts/update-trending.py 定期刷新）
    const cachePath = join(process.cwd(), 'src/data/trending-cache.json')
    const raw = readFileSync(cachePath, 'utf-8')
    const cache = JSON.parse(raw)

    const langData = cache[lang]
    if (langData && langData[category]) {
      return NextResponse.json(langData[category])
    }

    // category 不匹配时返回该语言的第一个分类
    const firstCategory = Object.values(langData || {})[0]
    if (firstCategory) return NextResponse.json(firstCategory)
  } catch (e) {
    // 缓存文件不存在或解析失败 → 继续 fallback
    console.warn('Trending cache miss:', e)
  }

  // Fallback: 触发后台刷新 + 返回临时占位数据
  triggerBackgroundRefresh().catch(console.error)
  return NextResponse.json(getFallback(lang, category))
}

// 占位数据（仅当缓存不存在时显示）
function getFallback(lang: string, category: string) {
  return [
    {
      id: `${lang}-fallback-1`,
      title: lang === 'zh' ? `正在获取${category}热点...` : `Loading ${category} topics...`,
      angle: lang === 'zh' ? '热点数据加载中，请稍后刷新' : 'Topics loading, refresh in a moment',
      source: lang === 'zh' ? '加载中' : 'Loading',
      date: new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US'),
      category,
      lang,
    },
  ]
}

// 后台触发 TrendRadar 刷新（非阻塞）
async function triggerBackgroundRefresh() {
  // 开发环境：直接调用 Python 脚本刷新缓存
  // 生产环境：调用 TrendRadar HTTP API
  const { exec } = await import('child_process')
  const scriptPath = join(process.cwd(), 'scripts/update-trending.py')
  const trPath = '/Users/gd-npc-848/TrendRadar'
  exec(
    `cd ${trPath} && uv run python ${scriptPath}`,
    { env: { ...process.env } },
    (err) => { if (err) console.error('TrendRadar refresh failed:', err.message) }
  )
}
