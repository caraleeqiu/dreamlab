'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Users, Clapperboard, ListTodo, Film, Coins, LogOut, Zap, Globe } from 'lucide-react'
import type { Language } from '@/types'
import { t, UI } from '@/lib/i18n'

const NAV_KEYS = [
  { href: '/home',        labelKey: UI.nav.home,        icon: LayoutDashboard },
  { href: '/influencers', labelKey: UI.nav.influencers, icon: Users },
  { href: '/studio',      labelKey: UI.nav.studio,      icon: Clapperboard },
  { href: '/jobs',        labelKey: UI.nav.jobs,        icon: ListTodo },
  { href: '/works',       labelKey: UI.nav.works,       icon: Film },
]

// Mobile bottom nav shows first 4 items only (screen space limit)
const MOBILE_NAV = NAV_KEYS.slice(0, 4)

export default function Sidebar({ language }: { language: Language }) {
  const pathname = usePathname()
  const router = useRouter()
  const lang = language

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function toggleLanguage() {
    const supabase = createClient()
    const next: Language = lang === 'zh' ? 'en' : 'zh'
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ language: next }).eq('id', user.id)
    router.refresh()
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-zinc-800 flex-col bg-zinc-900">
        {/* Logo */}
        <div className="h-14 flex items-center gap-2 px-5 border-b border-zinc-800">
          <Zap size={18} className="text-violet-400" />
          <span className="font-bold text-white tracking-tight">Dreamlab</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV_KEYS.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-violet-600/20 text-violet-300'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                <Icon size={16} />
                {t(lang, labelKey)}
              </Link>
            )
          })}
        </nav>

        {/* 底部：积分 + 语言切换 + 退出 */}
        <div className="px-3 py-4 border-t border-zinc-800 space-y-0.5">
          <Link
            href="/credits"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${pathname === '/credits' ? 'bg-violet-600/20 text-violet-300' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
          >
            <Coins size={16} />
            {t(lang, UI.nav.credits)}
          </Link>
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors w-full"
          >
            <Globe size={16} />
            <span>{lang === 'zh' ? '中文' : 'English'}</span>
            <span className="ml-auto text-xs text-zinc-600">{t(lang, UI.nav.switchLang)}</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors w-full"
          >
            <LogOut size={16} />
            {t(lang, UI.nav.logout)}
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav (4 items) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-zinc-900 border-t border-zinc-800 pb-safe">
        {MOBILE_NAV.map(({ href, labelKey, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium transition-colors ${active ? 'text-violet-300' : 'text-zinc-500'}`}
            >
              <Icon size={20} />
              <span>{t(lang, labelKey)}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
