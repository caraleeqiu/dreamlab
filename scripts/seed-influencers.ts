/**
 * 把内置网红种子数据写入 Supabase
 * 运行：npx tsx scripts/seed-influencers.ts
 * 需要先执行 source dev.sh 或手动设置环境变量
 */
import { createClient } from '@supabase/supabase-js'
import { BUILTIN_INFLUENCERS } from '../src/lib/influencers-seed'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seed() {
  console.log(`写入 ${BUILTIN_INFLUENCERS.length} 个内置网红...`)

  const { error } = await supabase
    .from('influencers')
    .upsert(
      BUILTIN_INFLUENCERS.map(inf => ({ ...inf, is_builtin: true, user_id: null })),
      { onConflict: 'slug' }
    )

  if (error) {
    console.error('写入失败:', error)
    process.exit(1)
  }

  console.log('完成！')
}

seed()
