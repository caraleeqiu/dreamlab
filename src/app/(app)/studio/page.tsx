import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { t, UI } from '@/lib/i18n'
import type { Language } from '@/types'

const LINE_KEYS = [
  { href: '/studio/trending', key: 'trending' as const, creditClass: 'text-green-400',  tag: 'trending' },
  { href: '/studio/podcast',  key: 'podcast'  as const, creditClass: 'text-violet-400', tag: 'podcast'  },
  { href: '/studio/remix',    key: 'remix'    as const, creditClass: 'text-violet-400', tag: 'remix'    },
  { href: '/studio/edu',      key: 'edu'      as const, creditClass: 'text-violet-400', tag: 'edu'      },
  { href: '/studio/anime',    key: 'anime'    as const, creditClass: 'text-amber-400',  tag: 'anime'    },
  { href: '/studio/story',    key: 'story'    as const, creditClass: 'text-violet-400', tag: 'story'    },
  { href: '/studio/script',   key: 'script'   as const, creditClass: 'text-violet-400', tag: 'script'   },
  { href: '/studio/link',     key: 'link'     as const, creditClass: 'text-violet-400', tag: 'link'     },
]

const EMOJIS: Record<string, string> = {
  trending: '🔥', podcast: '🎙️', remix: '✂️', edu: '📚',
  anime: '🎨', story: '🎬', script: '✍️', link: '🔗',
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {LINE_KEYS.map(line => {
          const strings = UI.studio.lines[line.key]
          return (
            <Link
              key={line.tag}
              href={line.href}
              className="group p-5 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800/80 transition-all"
            >
              <div className="text-3xl mb-3">{EMOJIS[line.tag]}</div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-semibold text-white">{t(lang, strings.title)}</h2>
                <span className={`text-xs font-medium shrink-0 ${line.creditClass}`}>{t(lang, strings.credit)}</span>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">{t(lang, strings.desc)}</p>
            </Link>
          )
        })}
      </div>

      <p className="text-center text-xs text-zinc-700 mt-8">
        {t(lang, UI.studio.balance)} {profile?.credits ?? 0} {t(lang, UI.studio.credits)} · {t(lang, UI.studio.language)}：{profile?.language === 'en' ? 'English' : '中文'}
      </p>
    </div>
  )
}
