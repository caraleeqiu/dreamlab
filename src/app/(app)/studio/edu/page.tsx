import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Language } from '@/types'

const SUB_TYPES = [
  {
    href: '/studio/edu/talk',
    emoji: '🎙️',
    title: { zh: '口播科普', en: 'Explainer Talk' },
    desc:  { zh: '话题 / 链接 / 论文 → 网红口播讲解，支持入门到专家深度', en: 'Topic / URL / Paper → Influencer explains with Hook-Explain-Apply structure' },
    credit: { zh: '15积分', en: '15 credits' },
    creditClass: 'text-violet-400',
    tags: { zh: ['口播', '科学', '任意深度'], en: ['Explainer', 'Science', 'Any depth'] },
  },
  {
    href: '/studio/edu/animated',
    emoji: '🎨',
    title: { zh: '动画科普故事', en: 'Animated Science Story' },
    desc:  { zh: '把科学原理变成动画故事，角色演绎 + 动漫视觉，寓教于乐', en: 'Turn science into animated stories — character drama + anime visuals' },
    credit: { zh: '30积分', en: '30 credits' },
    creditClass: 'text-amber-400',
    tags: { zh: ['动画', '故事', '动漫风格'], en: ['Animation', 'Story', 'Anime style'] },
  },
  {
    href: null,
    emoji: '📄',
    title: { zh: '论文解读', en: 'Paper Explainer' },
    desc:  { zh: '上传论文 PDF，AI 生成分镜概念图 + 网红解读视频（即将上线）', en: 'Upload a paper, AI generates concept diagrams + influencer explainer (coming soon)' },
    credit: { zh: '即将上线', en: 'Coming soon' },
    creditClass: 'text-zinc-600',
    tags: { zh: ['论文', '分镜图', 'Napkin AI'], en: ['Paper', 'Diagrams', 'Napkin AI'] },
    comingSoon: true,
  },
]

export default async function EduHubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('language, credits').eq('id', user!.id).single()

  const lang = (profile?.language ?? 'zh') as Language
  const isZh = lang === 'zh'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/studio" className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">
            📚 {isZh ? '网红科普' : 'Edu Content'}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isZh ? '用 AI 网红制作科普内容，从口播到动画故事' : 'Make science content with AI influencers'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {SUB_TYPES.map((type, i) => {
          const card = (
            <div
              key={i}
              className={`p-5 rounded-xl border transition-all ${
                type.comingSoon
                  ? 'border-zinc-800 bg-zinc-900/50 opacity-60 cursor-not-allowed'
                  : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800/80 cursor-pointer'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-2xl shrink-0 mt-0.5">{type.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-semibold text-white text-sm">
                        {type.title[lang]}
                      </h2>
                      {type.comingSoon && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                          {isZh ? '即将上线' : 'Soon'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed mb-2">
                      {type.desc[lang]}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {type.tags[lang].map(tag => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <span className={`text-xs font-medium shrink-0 ${type.creditClass}`}>
                  {type.credit[lang]}
                </span>
              </div>
            </div>
          )

          return type.href && !type.comingSoon
            ? <Link key={i} href={type.href}>{card}</Link>
            : <div key={i}>{card}</div>
        })}
      </div>

      <p className="text-center text-xs text-zinc-700 mt-6">
        {isZh ? '余额' : 'Balance'} {profile?.credits ?? 0} {isZh ? '积分' : 'credits'}
      </p>
    </div>
  )
}
