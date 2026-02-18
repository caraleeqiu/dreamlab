'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Video, Loader2, CheckCircle2, XCircle, Clock, ArrowRight } from 'lucide-react'
import type { Job } from '@/types'

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending:    { label: '等待中',  icon: <Clock size={14} />,      color: 'text-zinc-400' },
  scripting:  { label: '生成脚本', icon: <Loader2 size={14} className="animate-spin" />, color: 'text-blue-400' },
  generating: { label: '生成视频', icon: <Loader2 size={14} className="animate-spin" />, color: 'text-violet-400' },
  lipsync:    { label: '口型对齐', icon: <Loader2 size={14} className="animate-spin" />, color: 'text-violet-400' },
  stitching:  { label: '合并中',  icon: <Loader2 size={14} className="animate-spin" />, color: 'text-violet-400' },
  done:       { label: '完成',    icon: <CheckCircle2 size={14} />, color: 'text-green-400' },
  failed:     { label: '失败',    icon: <XCircle size={14} />,     color: 'text-red-400' },
}

const TYPE_LABEL: Record<string, string> = {
  podcast: '视频播客', remix: '爆款二创', edu: '网红科普', anime: '动漫营销', trending: '看灵感', story: '故事短片',
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJobs()
    const timer = setInterval(fetchJobs, 10000) // 每10秒刷新
    return () => clearInterval(timer)
  }, [])

  async function fetchJobs() {
    const res = await fetch('/api/jobs')
    const data = await res.json()
    setJobs(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Video size={20} className="text-zinc-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">任务</h1>
          <p className="text-sm text-zinc-500 mt-0.5">视频生成记录 · 每10秒自动刷新</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <Video size={40} className="mx-auto mb-3 opacity-30" />
          <p>还没有任务</p>
          <Link href="/studio" className="text-sm text-violet-400 hover:text-violet-300 mt-2 inline-block">
            去内容工厂创建
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {
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
                        {status.icon}
                        {status.label}
                      </span>
                    </div>
                    <h3 className="font-medium text-white text-sm truncate">{job.title || '无标题'}</h3>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-zinc-600">
                        {formatDistanceToNow(new Date(job.created_at), { locale: zhCN, addSuffix: true })}
                      </span>
                      <span className="text-xs text-zinc-700">{job.credit_cost} 积分</span>
                      {job.platform && <span className="text-xs text-zinc-700">{job.platform}</span>}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 mt-1" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
