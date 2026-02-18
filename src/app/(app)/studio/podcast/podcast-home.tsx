'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import {
  Flame, FileText, PenLine,
  CheckCircle2, XCircle, Clock, Loader2,
  ArrowLeft, ArrowRight, Mic,
} from 'lucide-react'
import Link from 'next/link'
import PodcastWizard from './podcast-wizard'
import { UI, t } from '@/lib/i18n'
import type { Influencer, Job, Language } from '@/types'

type PodcastMode = 'trending' | 'import' | 'custom'

interface Props {
  lang: Language
  credits: number
  influencers: Influencer[]
  recentJobs: Job[]
}

export default function PodcastClient({ lang, credits, influencers, recentJobs }: Props) {
  const [mode, setMode] = useState<PodcastMode | null>(null)

  const MODES: { id: PodcastMode; icon: React.ReactNode; title: string; desc: string; badge?: string }[] = [
    {
      id: 'trending',
      icon: <Flame size={22} className="text-orange-400" />,
      title: lang === 'zh' ? '热点话题' : 'Trending Topics',
      badge: lang === 'zh' ? '最热门' : 'Popular',
      desc: lang === 'zh'
        ? '从今日热榜选题，AI 自动提炼要点生成播客'
        : 'Pick from today\'s trending topics, AI extracts key points',
    },
    {
      id: 'import',
      icon: <FileText size={22} className="text-blue-400" />,
      title: lang === 'zh' ? '导入内容' : 'Import Content',
      desc: lang === 'zh'
        ? '粘贴链接 / 文章内容，AI 提炼成播客'
        : 'Paste a link or article content, AI turns it into a podcast',
    },
    {
      id: 'custom',
      icon: <PenLine size={22} className="text-violet-400" />,
      title: lang === 'zh' ? '自己写' : 'Write Your Own',
      desc: lang === 'zh'
        ? '直接输入话题或贴入脚本，自由创作'
        : 'Enter a topic or paste a script, free-form creation',
    },
  ]

  const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    pending:    { label: t(lang, UI.jobs.status.pending),    icon: <Clock size={12} />,      color: 'text-zinc-400' },
    scripting:  { label: t(lang, UI.jobs.status.scripting),  icon: <Loader2 size={12} className="animate-spin" />, color: 'text-blue-400' },
    generating: { label: t(lang, UI.jobs.status.generating), icon: <Loader2 size={12} className="animate-spin" />, color: 'text-violet-400' },
    lipsync:    { label: t(lang, UI.jobs.status.lipsync),    icon: <Loader2 size={12} className="animate-spin" />, color: 'text-violet-400' },
    stitching:  { label: t(lang, UI.jobs.status.stitching),  icon: <Loader2 size={12} className="animate-spin" />, color: 'text-violet-400' },
    done:       { label: t(lang, UI.jobs.status.done),       icon: <CheckCircle2 size={12} />, color: 'text-green-400' },
    failed:     { label: t(lang, UI.jobs.status.failed),     icon: <XCircle size={12} />,     color: 'text-red-400' },
  }

  const dateLocale = lang === 'zh' ? zhCN : enUS

  // — Wizard view —
  if (mode) {
    return (
      <div>
        <button
          onClick={() => setMode(null)}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          {lang === 'zh' ? '返回播客入口' : 'Back to Podcast'}
        </button>
        <PodcastWizard
          lang={lang}
          credits={credits}
          influencers={influencers}
          initialMode={mode}
        />
      </div>
    )
  }

  // — Entry view —
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Mic size={20} className="text-zinc-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">{t(lang, UI.studio.lines.podcast.title)}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {lang === 'zh' ? '解说万物的播客频道' : 'A podcast channel for everything'} · 20 {t(lang, UI.studio.credits)}/ep
          </p>
        </div>
      </div>

      {/* 3 creation modes */}
      <p className="text-xs text-zinc-600 uppercase tracking-widest mb-3">
        {lang === 'zh' ? '选择创作方式' : 'Choose creation mode'}
      </p>
      <div className="space-y-3 mb-10">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900
                       hover:border-zinc-600 hover:bg-zinc-800 transition-all group text-left"
          >
            <div className="shrink-0">{m.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white text-sm">{m.title}</span>
                {m.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                    {m.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">{m.desc}</p>
            </div>
            <ArrowRight size={14} className="text-zinc-600 group-hover:text-zinc-400 shrink-0 transition-colors" />
          </button>
        ))}
      </div>

      {/* Recent history */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-600 uppercase tracking-widest">
          {lang === 'zh' ? '最近记录' : 'Recent'}
        </p>
        <Link href="/jobs" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          {lang === 'zh' ? '查看全部 →' : 'View all →'}
        </Link>
      </div>

      {recentJobs.length === 0 ? (
        <div className="text-center py-10 text-zinc-700 text-sm">
          {lang === 'zh' ? '还没有播客记录，选择上方任意方式开始' : 'No podcast jobs yet — pick a mode above to start'}
        </div>
      ) : (
        <div className="space-y-2">
          {recentJobs.map(job => {
            const s = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending
            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900
                           hover:border-zinc-700 transition-all group"
              >
                <div className={`flex items-center gap-1 text-xs ${s.color} shrink-0`}>
                  {s.icon}
                  <span>{s.label}</span>
                </div>
                <span className="text-sm text-zinc-300 truncate flex-1">
                  {job.title || t(lang, UI.jobs.untitled)}
                </span>
                <span className="text-xs text-zinc-600 shrink-0">
                  {formatDistanceToNow(new Date(job.created_at), { locale: dateLocale, addSuffix: true })}
                </span>
                <ArrowRight size={12} className="text-zinc-700 group-hover:text-zinc-500 shrink-0 transition-colors" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
