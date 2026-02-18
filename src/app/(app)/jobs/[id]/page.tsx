'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Job, Clip } from '@/types'
import { useLanguage } from '@/context/language-context'
import { t, UI } from '@/lib/i18n'

const STATUS_STEPS = ['pending', 'scripting', 'generating', 'lipsync', 'stitching', 'done']

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const lang = useLanguage()
  const [job, setJob] = useState<(Job & { clips?: Clip[] }) | null>(null)
  const [loading, setLoading] = useState(true)

  const STATUS_LABEL: Record<string, string> = {
    pending:    t(lang, UI.jobs.status.pending),
    scripting:  t(lang, UI.jobs.status.scripting),
    generating: t(lang, UI.jobs.status.generating),
    lipsync:    t(lang, UI.jobs.status.lipsync),
    stitching:  t(lang, UI.jobs.status.stitching),
    done:       t(lang, UI.jobs.status.done),
    failed:     t(lang, UI.jobs.status.failed),
  }

  useEffect(() => {
    fetchJob()
    const timer = setInterval(() => {
      if (job?.status !== 'done' && job?.status !== 'failed') poll()
    }, 10000)
    return () => clearInterval(timer)
  }, [id, job?.status])

  async function fetchJob() {
    const res = await fetch(`/api/jobs/${id}`)
    const data = await res.json()
    setJob(data)
    setLoading(false)
  }

  async function poll() {
    const res = await fetch(`/api/jobs/${id}/poll`)
    const data = await res.json()
    setJob(prev => prev ? { ...prev, ...data } : prev)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-zinc-500" />
    </div>
  )
  if (!job) return <div className="text-zinc-500 text-center py-20">{t(lang, UI.jobs.jobNotFound)}</div>

  const stepIdx = STATUS_STEPS.indexOf(job.status)
  const isFailed = job.status === 'failed'
  const isDone = job.status === 'done'
  const dateStr = lang === 'zh'
    ? new Date(job.created_at).toLocaleString('zh-CN')
    : new Date(job.created_at).toLocaleString('en-US')

  return (
    <div className="max-w-2xl mx-auto">
      {/* 返回 */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={15} /> {t(lang, UI.jobs.backToList)}
      </button>

      {/* 标题 */}
      <h1 className="text-xl font-bold text-white mb-1">{job.title || t(lang, UI.jobs.untitled)}</h1>
      <div className="flex gap-3 text-xs text-zinc-500 mb-8">
        <span>#{job.id}</span>
        <span>{job.credit_cost} {t(lang, UI.jobs.credits)}</span>
        <span>{dateStr}</span>
      </div>

      {/* 进度条 */}
      <div className="mb-8">
        <div className="flex items-center gap-0 mb-3">
          {STATUS_STEPS.filter(s => s !== 'pending').map((s, i) => {
            const done = stepIdx > STATUS_STEPS.indexOf(s) || (isDone && s === 'done')
            const active = s === job.status
            return (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors
                    ${isFailed && active ? 'bg-red-600 text-white' :
                      done ? 'bg-violet-600 text-white' :
                      active ? 'bg-violet-600/50 text-white ring-2 ring-violet-400/30' :
                      'bg-zinc-800 text-zinc-600'}`}>
                    {done ? '✓' : active && !isDone ? <Loader2 size={12} className="animate-spin" /> : i + 1}
                  </div>
                  <span className={`text-xs mt-1 whitespace-nowrap ${active ? 'text-white' : 'text-zinc-600'}`}>
                    {STATUS_LABEL[s]}
                  </span>
                </div>
                {i < STATUS_STEPS.filter(s => s !== 'pending').length - 1 && (
                  <div className={`flex-1 h-px mx-1 mb-4 ${done ? 'bg-violet-600' : 'bg-zinc-800'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 切片进度 */}
      {job.clips && job.clips.length > 0 && !isDone && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">
            {lang === 'zh'
              ? `切片进度（${job.clips.filter(c => c.status === 'done').length}/${job.clips.length}）`
              : `Clips (${job.clips.filter(c => c.status === 'done').length}/${job.clips.length})`}
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {job.clips.map(clip => (
              <div key={clip.id} className={`aspect-video rounded-lg flex items-center justify-center text-xs font-medium
                ${clip.status === 'done' ? 'bg-green-900/30 text-green-400' :
                  clip.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                  clip.status === 'submitted' || clip.status === 'processing' ? 'bg-violet-900/30 text-violet-400' :
                  'bg-zinc-800 text-zinc-600'}`}>
                {clip.status === 'done' ? <CheckCircle2 size={14} /> :
                 clip.status === 'failed' ? <XCircle size={14} /> :
                 clip.status === 'submitted' || clip.status === 'processing' ? <Loader2 size={14} className="animate-spin" /> :
                 clip.clip_index + 1}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 完成：视频预览 */}
      {isDone && (
        <div className="space-y-6">
          {job.final_video_url && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-zinc-400">
                {lang === 'zh' ? '生成结果' : 'Result'}
              </h2>
              <video
                src={job.final_video_url}
                controls
                className="w-full max-w-sm mx-auto rounded-xl border border-zinc-700"
                style={{ aspectRatio: job.aspect_ratio?.replace(':', '/') }}
              />
              <div className="flex justify-center">
                <a href={job.final_video_url} download
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
                  <Download size={14} />
                  {t(lang, UI.jobs.downloadAll)}
                </a>
              </div>
            </div>
          )}

          {job.clips && job.clips.filter(c => c.lipsync_url || c.video_url).length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-zinc-400">
                {job.clips.filter(c => c.lipsync_url || c.video_url).length > 1
                  ? (lang === 'zh' ? '各片段独立下载' : 'Download individual clips')
                  : ''}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {job.clips.filter(c => c.lipsync_url || c.video_url).map(clip => (
                  <div key={clip.id} className="space-y-1.5">
                    <video
                      src={clip.lipsync_url || clip.video_url}
                      controls
                      className="w-full rounded-lg border border-zinc-700"
                      style={{ aspectRatio: job.aspect_ratio?.replace(':', '/') }}
                    />
                    <a href={clip.lipsync_url || clip.video_url} download
                      className="flex items-center justify-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors">
                      <Download size={11} /> {t(lang, UI.jobs.downloadClip)} {clip.clip_index + 1}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 失败 */}
      {isFailed && (
        <div className="p-4 rounded-xl bg-red-900/20 border border-red-800 text-red-400 text-sm">
          <div className="font-medium mb-1">{lang === 'zh' ? '生成失败' : 'Generation failed'}</div>
          <div className="text-red-500">{job.error_msg || (lang === 'zh' ? '未知错误' : 'Unknown error')}</div>
        </div>
      )}
    </div>
  )
}
