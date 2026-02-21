'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import {
  Flame, FileText, PenLine, Link2,
  CheckCircle2, XCircle, Clock, Loader2,
  ArrowLeft, ArrowRight, Mic,
} from 'lucide-react'
import Link from 'next/link'
import PodcastWizard from './podcast-wizard'
import { UI, t } from '@/lib/i18n'
import type { Influencer, Job, Language } from '@/types'

type PodcastMode = 'trending' | 'write' | 'url' | 'pdf'

interface Props {
  lang: Language
  credits: number
  influencers: Influencer[]
  recentJobs: Job[]
  initialPrefs?: Record<string, unknown>
}

export default function PodcastClient({ lang, credits, influencers, recentJobs, initialPrefs = {} }: Props) {
  const [mode, setMode] = useState<PodcastMode | null>(null)

  const MODES: { id: PodcastMode; icon: React.ReactNode; title: string; desc: string; badge?: string }[] = [
    {
      id: 'trending',
      icon: <Flame size={22} className="text-orange-400" />,
      title: lang === 'zh' ? '🔥 热点直出' : '🔥 Trending Topics',
      badge: lang === 'zh' ? '最热门' : 'Popular',
      desc: lang === 'zh'
        ? '从今日热榜选题，AI 自动提炼要点生成播客'
        : 'Pick from today\'s trending topics, AI extracts key points',
    },
    {
      id: 'write',
      icon: <PenLine size={22} className="text-violet-400" />,
      title: lang === 'zh' ? '✍️ 自己写' : '✍️ Write Your Own',
      desc: lang === 'zh'
        ? '粘贴文章、书摘或脚本大纲，自由创作'
        : 'Paste an article, book excerpt, or outline — free-form creation',
    },
    {
      id: 'url',
      icon: <Link2 size={22} className="text-blue-400" />,
      title: lang === 'zh' ? '🔗 粘贴链接' : '🔗 Paste URL',
      desc: lang === 'zh'
        ? '粘贴任意文章链接，AI 读取并提炼播客观点'
        : 'Paste any article URL, AI reads and extracts podcast insights',
    },
    {
      id: 'pdf',
      icon: <FileText size={22} className="text-green-400" />,
      title: lang === 'zh' ? '📄 上传 PDF' : '📄 Upload PDF',
      desc: lang === 'zh'
        ? '上传书籍或报告 PDF，AI 提炼核心观点变播客'
        : 'Upload a book or report PDF, AI extracts core insights',
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
          initialPrefs={initialPrefs}
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className="flex flex-col items-start p-5 rounded-xl border border-zinc-800 bg-zinc-900
                       hover:border-zinc-600 hover:bg-zinc-800 transition-all group text-left"
          >
            <div className="mb-3">{m.icon}</div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-white text-sm">{m.title}</span>
              {m.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                  {m.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">{m.desc}</p>
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
