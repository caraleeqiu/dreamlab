'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { Video, Loader2, CheckCircle2, XCircle, Clock, ArrowRight, Clapperboard } from 'lucide-react'
import type { Job } from '@/types'
import { useLanguage } from '@/context/language-context'
import { t, UI } from '@/lib/i18n'

export default function HomePage() {
  const lang = useLanguage()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  const STATUS_CONFIG = {
    pending:    { label: t(lang, UI.jobs.status.pending),    icon: <Clock size={14} />,      color: 'text-zinc-400' },
    scripting:  { label: t(lang, UI.jobs.status.scripting),  icon: <Loader2 size={14} className="animate-spin" />, color: 'text-blue-400' },
    generating: { label: t(lang, UI.jobs.status.generating), icon: <Loader2 size={14} className="animate-spin" />, color: 'text-violet-400' },
    lipsync:    { label: t(lang, UI.jobs.status.lipsync),    icon: <Loader2 size={14} className="animate-spin" />, color: 'text-violet-400' },
    stitching:  { label: t(lang, UI.jobs.status.stitching),  icon: <Loader2 size={14} className="animate-spin" />, color: 'text-violet-400' },
    done:       { label: t(lang, UI.jobs.status.done),       icon: <CheckCircle2 size={14} />, color: 'text-green-400' },
    failed:     { label: t(lang, UI.jobs.status.failed),     icon: <XCircle size={14} />,     color: 'text-red-400' },
  } as Record<string, { label: string; icon: React.ReactNode; color: string }>

  const TYPE_LABEL = Object.fromEntries(
    Object.entries(UI.jobs.types).map(([k, v]) => [k, t(lang, v)])
  )

  const dateLocale = lang === 'zh' ? zhCN : enUS

  useEffect(() => {
    fetchJobs()
    const timer = setInterval(fetchJobs, 10000)
    return () => clearInterval(timer)
  }, [])

  async function fetchJobs() {
    const res = await fetch('/api/jobs')
    const data = await res.json()
    setJobs(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const active  = jobs.filter(j => !['done', 'failed'].includes(j.status))
  const history = jobs.filter(j => ['done', 'failed'].includes(j.status))

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{lang === 'zh' ? '我的作品' : 'My Works'}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {lang === 'zh' ? '任务进度与历史视频' : 'Task progress and video history'}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <Video size={40} className="mx-auto mb-3 opacity-30" />
          <p className="mb-2">{lang === 'zh' ? '还没有作品' : 'No works yet'}</p>
          <Link href="/studio" className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300">
            <Clapperboard size={14} />
            {lang === 'zh' ? '去内容工厂创作' : 'Start creating in Studio'}
          </Link>
        </div>
      ) : (
        <>
          {/* 进行中的任务 */}
          {active.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">
                {lang === 'zh' ? '任务进度' : 'In Progress'}
              </h2>
              <div className="space-y-3">
                {active.map(job => {
                  const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending
                  return (
                    <Link key={job.id} href={`/jobs/${job.id}`}
                      className="block p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 transition-all group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              {TYPE_LABEL[job.type] || job.type}
                            </span>
                            <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                              {status.icon}{status.label}
                            </span>
                          </div>
                          <h3 className="font-medium text-white text-sm truncate">{job.title || t(lang, UI.jobs.untitled)}</h3>
                          <span className="text-xs text-zinc-600 mt-1 block">
                            {formatDistanceToNow(new Date(job.created_at), { locale: dateLocale, addSuffix: true })}
                          </span>
                        </div>
                        <ArrowRight size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 mt-1" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* 历史作品 */}
          {history.length > 0 && (
            <section>
              <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">
                {lang === 'zh' ? '历史作品' : 'History'}
              </h2>
              <div className="space-y-3">
                {history.map(job => {
                  const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.done
                  return (
                    <Link key={job.id} href={`/jobs/${job.id}`}
                      className="block p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 transition-all group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              {TYPE_LABEL[job.type] || job.type}
                            </span>
                            <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                              {status.icon}{status.label}
                            </span>
                          </div>
                          <h3 className="font-medium text-white text-sm truncate">{job.title || t(lang, UI.jobs.untitled)}</h3>
                          <div className="flex gap-3 mt-1">
                            <span className="text-xs text-zinc-600">
                              {formatDistanceToNow(new Date(job.created_at), { locale: dateLocale, addSuffix: true })}
                            </span>
                            <span className="text-xs text-zinc-700">{job.credit_cost} {t(lang, UI.jobs.credits)}</span>
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 mt-1" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
