import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { t, UI } from '@/lib/i18n'
import type { Language } from '@/types'

const REMIX_LINES = [
  { href: '/studio/remix', key: 'remix' as const, emoji: '✂️', creditClass: 'text-violet-400' },
]

const ORIGINAL_LINES = [
  { href: '/studio/podcast', key: 'podcast' as const, emoji: '🎙️', creditClass: 'text-violet-400' },
  { href: '/studio/edu',     key: 'edu'     as const, emoji: '📚', creditClass: 'text-violet-400' },
  { href: '/studio/anime',   key: 'anime'   as const, emoji: '🎨', creditClass: 'text-amber-400'  },
  { href: '/studio/story',   key: 'story'   as const, emoji: '🎬', creditClass: 'text-violet-400' },
]

function LineCard({ line, lang }: { line: typeof ORIGINAL_LINES[0]; lang: Language }) {
  const strings = UI.studio.lines[line.key]
  return (
    <Link
      href={line.href}
      className="group p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800/80 transition-all flex flex-col"
    >
      <div className="text-2xl mb-2">{line.emoji}</div>
      <div className="flex items-center justify-between gap-1 mb-1">
        <h2 className="font-semibold text-white text-sm">{t(lang, strings.title)}</h2>
        <span className={`text-xs font-medium shrink-0 ${line.creditClass}`}>{t(lang, strings.credit)}</span>
      </div>
      <p className="text-xs text-zinc-500 truncate">{t(lang, strings.desc)}</p>
    </Link>
  )
}

export default async function StudioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits, language')
    .eq('id', user!.id)
    .single()

  const lang = (profile?.language ?? 'zh') as Language

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{t(lang, UI.studio.title)}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{t(lang, UI.studio.subtitle)}</p>
      </div>

      {/* 看灵感 */}
      <section className="mb-8">
        <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">
          {lang === 'zh' ? '看灵感' : 'Get Inspired · Free'}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/studio/trending"
            className="group p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-green-800/60 hover:bg-zinc-800/80 transition-all flex flex-col"
          >
            <div className="text-2xl mb-2">🔥</div>
            <div className="flex items-center justify-between gap-1 mb-1">
              <h2 className="font-semibold text-white text-sm">{t(lang, UI.studio.lines.trending.title)}</h2>
              <span className="text-xs font-medium text-green-400 shrink-0">{t(lang, UI.studio.lines.trending.credit)}</span>
            </div>
            <p className="text-xs text-zinc-500 truncate">{t(lang, UI.studio.lines.trending.desc)}</p>
          </Link>
        </div>
      </section>

      {/* 爆款二创 */}
      <section className="mb-8">
        <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">
          {lang === 'zh' ? '爆款二创' : 'Viral Remix'}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {REMIX_LINES.map(line => <LineCard key={line.key} line={line} lang={lang} />)}
        </div>
      </section>

      {/* 内容原创 */}
      <section>
        <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">
          {lang === 'zh' ? '内容原创' : 'Original Content'}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ORIGINAL_LINES.map(line => <LineCard key={line.key} line={line} lang={lang} />)}
        </div>
      </section>

      <p className="text-center text-xs text-zinc-700 mt-8">
        {t(lang, UI.studio.balance)} {profile?.credits ?? 0} {t(lang, UI.studio.credits)} · {t(lang, UI.studio.language)}：{profile?.language === 'en' ? 'English' : '中文'}
      </p>
    </div>
  )
}
