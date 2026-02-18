'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { ListTodo, Loader2, Clock, ArrowRight, Clapperboard } from 'lucide-react'
import type { Job } from '@/types'
import { useLanguage } from '@/context/language-context'
import { t, UI } from '@/lib/i18n'

// Steps in order for progress dots
const STEPS = ['pending', 'scripting', 'generating', 'lipsync', 'stitching']
const STEP_LABELS_ZH = ['等待', '脚本', '生成', '口型', '合成']
const STEP_LABELS_EN = ['Queue', 'Script', 'Video', 'Lip', 'Stitch']

function StepDots({ status, lang }: { status: string; lang: string }) {
  const cur = STEPS.indexOf(status)
  const labels = lang === 'zh' ? STEP_LABELS_ZH : STEP_LABELS_EN
  return (
    <div className="flex items-center gap-1 mt-2">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="flex flex-col items-center gap-0.5">
            <div className={`w-2 h-2 rounded-full transition-colors ${
              i < cur  ? 'bg-violet-500' :
              i === cur ? 'bg-violet-400 animate-pulse ring-2 ring-violet-400/30' :
              'bg-zinc-700'
            }`} />
            <span className={`text-[9px] leading-none ${i === cur ? 'text-violet-400' : 'text-zinc-600'}`}>
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div className={`w-4 h-px mb-3 ${i < cur ? 'bg-violet-500/50' : 'bg-zinc-800'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function JobsPage() {
  const lang = useLanguage()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  const dateLocale = lang === 'zh' ? zhCN : enUS
  const TYPE_LABEL = Object.fromEntries(
    Object.entries(UI.jobs.types).map(([k, v]) => [k, t(lang, v)])
  )

  useEffect(() => {
    fetchJobs()
    const timer = setInterval(fetchJobs, 8000)
    return () => clearInterval(timer)
  }, [])

  async function fetchJobs() {
    const res = await fetch('/api/jobs')
    const data = await res.json()
    const active = (Array.isArray(data) ? data : []).filter(
      (j: Job) => !['done', 'failed'].includes(j.status)
    )
    setJobs(active)
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          {lang === 'zh' ? '任务管理' : 'Tasks'}
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {lang === 'zh' ? '进行中的任务 · 每8秒自动刷新' : 'In-progress tasks · refreshes every 8s'}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-28 rounded-xl bg-zinc-800 animate-pulse" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <ListTodo size={40} className="mx-auto mb-3 opacity-30" />
          <p className="mb-2">{lang === 'zh' ? '没有进行中的任务' : 'No active tasks'}</p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <Link href="/studio" className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1">
              <Clapperboard size={13} />
              {lang === 'zh' ? '去创作' : 'Create'}
            </Link>
            <Link href="/works" className="text-sm text-zinc-500 hover:text-zinc-300">
              {lang === 'zh' ? '查看历史作品 →' : 'View works →'}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <Link key={job.id} href={`/jobs/${job.id}`}
              className="group block p-5 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-violet-800/50 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {TYPE_LABEL[job.type] || job.type}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-violet-400">
                      {job.status === 'pending'
                        ? <Clock size={11} className="text-zinc-500" />
                        : <Loader2 size={11} className="animate-spin" />
                      }
                      {t(lang, UI.jobs.status[job.status as keyof typeof UI.jobs.status] ?? UI.jobs.status.pending)}
                    </span>
                  </div>
                  <h3 className="font-medium text-white text-sm truncate mb-0.5">
                    {job.title || t(lang, UI.jobs.untitled)}
                  </h3>
                  <p className="text-xs text-zinc-600">
                    {formatDistanceToNow(new Date(job.created_at), { locale: dateLocale, addSuffix: true })}
                    {job.platform && ` · ${job.platform}`}
                  </p>
                  <StepDots status={job.status} lang={lang} />
                </div>
                <ArrowRight size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
