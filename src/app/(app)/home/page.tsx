'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { Loader2, CheckCircle2, XCircle, Clock, Clapperboard, ArrowRight, Film } from 'lucide-react'
import type { Job } from '@/types'
import { useLanguage } from '@/context/language-context'
import { t, UI } from '@/lib/i18n'

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

export default function HomePage() {
  const lang = useLanguage()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  const dateLocale = lang === 'zh' ? zhCN : enUS
  const TYPE_LABEL = Object.fromEntries(
    Object.entries(UI.jobs.types).map(([k, v]) => [k, t(lang, v)])
  )

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
  const history = jobs.filter(j => ['done', 'failed'].includes(j.status)).slice(0, 6)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          {lang === 'zh' ? '工作台' : 'Dashboard'}
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {lang === 'zh' ? '任务进度 · 最近作品' : 'Task progress · Recent works'}
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-24 rounded-xl bg-zinc-800 animate-pulse" />)}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="aspect-video rounded-xl bg-zinc-800 animate-pulse" />)}</div>
        </div>
      ) : (
        <>
          {/* ── 任务进度 ── */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider">
                {lang === 'zh' ? '任务进度' : 'In Progress'}
                {active.length > 0 && <span className="ml-2 text-violet-400">{active.length}</span>}
              </h2>
              <Link href="/jobs" className="text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1">
                {lang === 'zh' ? '任务管理' : 'Manage'} <ArrowRight size={11} />
              </Link>
            </div>

            {active.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center">
                <p className="text-sm text-zinc-600">
                  {lang === 'zh' ? '暂无进行中的任务' : 'No tasks in progress'}
                </p>
                <Link href="/studio" className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 mt-2">
                  <Clapperboard size={12} />
                  {lang === 'zh' ? '去内容创作' : 'Start creating'}
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {active.map(job => (
                  <Link key={job.id} href={`/jobs/${job.id}`}
                    className="group p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-violet-800/50 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            {TYPE_LABEL[job.type] || job.type}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-violet-400">
                            {job.status === 'pending'
                              ? <Clock size={11} className="text-zinc-500" />
                              : <Loader2 size={11} className="animate-spin" />}
                            {t(lang, UI.jobs.status[job.status as keyof typeof UI.jobs.status] ?? UI.jobs.status.pending)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-white truncate">
                          {job.title || t(lang, UI.jobs.untitled)}
                        </p>
                        <StepDots status={job.status} lang={lang} />
                      </div>
                      <ArrowRight size={14} className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0 mt-1" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* ── 最近作品 ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider">
                {lang === 'zh' ? '最近作品' : 'Recent Works'}
              </h2>
              <Link href="/works" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                {lang === 'zh' ? '查看全部' : 'View all'} <ArrowRight size={11} />
              </Link>
            </div>

            {history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
                <Film size={32} className="mx-auto mb-2 text-zinc-800" />
                <p className="text-sm text-zinc-600">
                  {lang === 'zh' ? '还没有完成的作品' : 'No completed works yet'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {history.map(job => (
                  <Link key={job.id} href={`/jobs/${job.id}`}
                    className="group rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 overflow-hidden transition-all">
                    <div className="aspect-video bg-zinc-800 flex items-center justify-center relative">
                      {job.final_video_url ? (
                        <video src={job.final_video_url} className="w-full h-full object-cover" muted />
                      ) : (
                        <Film size={20} className="text-zinc-700" />
                      )}
                      {job.status === 'failed' && (
                        <div className="absolute inset-0 bg-red-900/30 flex items-center justify-center">
                          <XCircle size={20} className="text-red-400" />
                        </div>
                      )}
                      {job.status === 'done' && (
                        <CheckCircle2 size={14} className="text-green-400 absolute top-1.5 right-1.5" />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-white truncate">
                        {job.title || t(lang, UI.jobs.untitled)}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-zinc-600">{TYPE_LABEL[job.type] || job.type}</span>
                        <span className="text-[10px] text-zinc-700">
                          {formatDistanceToNow(new Date(job.created_at), { locale: dateLocale, addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
