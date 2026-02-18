import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const LINES = [
  {
    href: '/studio/trending',
    emoji: '🔥',
    title: '看灵感',
    desc: '浏览实时热点，发现下一个爆款话题',
    credit: '免费',
    creditClass: 'text-green-400',
    tag: 'trending',
  },
  {
    href: '/studio/podcast',
    emoji: '🎙️',
    title: '视频播客',
    desc: '选热点 → AI提炼要点 → 一键生成播客视频',
    credit: '20积分',
    creditClass: 'text-violet-400',
    tag: 'podcast',
  },
  {
    href: '/studio/remix',
    emoji: '✂️',
    title: '爆款二创',
    desc: '上传原视频，AI改编成你的网红风格',
    credit: '5积分',
    creditClass: 'text-violet-400',
    tag: 'remix',
  },
  {
    href: '/studio/edu',
    emoji: '📚',
    title: '网红科普',
    desc: '输入话题，网红用自己的风格讲给你听',
    credit: '15积分',
    creditClass: 'text-violet-400',
    tag: 'edu',
  },
  {
    href: '/studio/anime',
    emoji: '🎨',
    title: '动漫营销视频',
    desc: '品牌产品 × AI网红 → 动漫风格营销短片',
    credit: '50积分',
    creditClass: 'text-amber-400',
    tag: 'anime',
  },
  {
    href: '/studio/story',
    emoji: '🎬',
    title: '故事短片',
    desc: '输入剧情创意，AI生成有叙事的剧情短片',
    credit: '30积分',
    creditClass: 'text-violet-400',
    tag: 'story',
  },
  {
    href: '/studio/script',
    emoji: '✍️',
    title: '自定义脚本',
    desc: '写脚本或贴稿子，AI优化后生成视频',
    credit: '15积分',
    creditClass: 'text-violet-400',
    tag: 'script',
  },
  {
    href: '/studio/link',
    emoji: '🔗',
    title: '链接提取',
    desc: '贴URL，AI提炼内容，一键生成视频',
    credit: '15积分',
    creditClass: 'text-violet-400',
    tag: 'link',
  },
]

export default async function StudioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits, language')
    .eq('id', user!.id)
    .single()

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">内容工厂</h1>
        <p className="text-sm text-zinc-500 mt-0.5">选择生产线，开始创作</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {LINES.map(line => (
          <Link
            key={line.tag}
            href={line.href}
            className="group p-5 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800/80 transition-all"
          >
            <div className="text-3xl mb-3">{line.emoji}</div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h2 className="font-semibold text-white">{line.title}</h2>
              <span className={`text-xs font-medium shrink-0 ${line.creditClass}`}>{line.credit}</span>
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed">{line.desc}</p>
          </Link>
        ))}
      </div>

      <p className="text-center text-xs text-zinc-700 mt-8">
        当前余额 {profile?.credits ?? 0} 积分 · 语言：{profile?.language === 'en' ? 'English' : '中文'}
      </p>
    </div>
  )
}
