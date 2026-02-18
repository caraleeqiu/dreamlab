'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Home, Users, Clapperboard, Coins, LogOut, Zap, Globe } from 'lucide-react'
import type { Language } from '@/types'

const NAV = [
  { href: '/',            label: '主页',     icon: Home },
  { href: '/studio',      label: '内容工厂', icon: Clapperboard },
  { href: '/influencers', label: '网红库',   icon: Users },
  { href: '/credits',     label: '积分',     icon: Coins },
]

export default function Sidebar({ language }: { language: Language }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function toggleLanguage() {
    const supabase = createClient()
    const next: Language = language === 'zh' ? 'en' : 'zh'
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
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
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
                {label}
              </Link>
            )
          })}
        </nav>

        {/* 底部：语言切换 + 退出 */}
        <div className="px-3 py-4 border-t border-zinc-800 space-y-0.5">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors w-full"
          >
            <Globe size={16} />
            <span>{language === 'zh' ? '中文' : 'English'}</span>
            <span className="ml-auto text-xs text-zinc-600">切换</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors w-full"
          >
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-zinc-900 border-t border-zinc-800 pb-safe">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium transition-colors ${active ? 'text-violet-300' : 'text-zinc-500'}`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
