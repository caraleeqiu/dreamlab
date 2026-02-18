'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useLanguage } from '@/context/language-context'
import CreditBadge from './credit-badge'

// Map: if pathname starts with key → show back button to value
const BACK_MAP: Array<{ prefix: string; to: string; labelZh: string; labelEn: string }> = [
  { prefix: '/studio/',    to: '/studio',      labelZh: '内容创作', labelEn: 'Studio' },
  { prefix: '/jobs/',      to: '/jobs',        labelZh: '任务管理', labelEn: 'Tasks' },
  { prefix: '/influencers/', to: '/influencers', labelZh: '网红管理', labelEn: 'Influencers' },
]

export default function AppHeader({ credits }: { credits: number }) {
  const pathname = usePathname()
  const lang = useLanguage()

  const back = BACK_MAP.find(r => pathname.startsWith(r.prefix))

  return (
    <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-2">
        {/* Mobile: Dreamlab logo (when no back) or back button */}
        {back ? (
          <Link
            href={back.to}
            className="flex items-center gap-1 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            <ChevronLeft size={16} />
            <span>{lang === 'zh' ? back.labelZh : back.labelEn}</span>
          </Link>
        ) : (
          <span className="md:hidden font-bold text-white text-sm">Dreamlab</span>
        )}
      </div>
      <CreditBadge credits={credits} />
    </header>
  )
}
