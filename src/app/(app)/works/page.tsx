'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { Film, CheckCircle2, XCircle, Pencil, Trash2, Check, X } from 'lucide-react'
import type { Job } from '@/types'
import { useLanguage } from '@/context/language-context'
import { t, UI } from '@/lib/i18n'

const TYPE_FILTERS = [
  { value: 'all',     zh: '全部',   en: 'All' },
  { value: 'podcast', zh: '视频播客', en: 'Podcast' },
  { value: 'remix',   zh: '爆款二创', en: 'Remix' },
  { value: 'edu',     zh: '网红科普', en: 'Edu' },
  { value: 'anime',   zh: '动漫营销', en: 'Anime' },
  { value: 'story',   zh: '故事短片', en: 'Story' },
]

function EditableTitle({ job, onUpdate, lang }: {
  job: Job
  onUpdate: (id: number, title: string) => void
  lang: string
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(job.title || '')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setValue(job.title || '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function save(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault()
    e.stopPropagation()
    const trimmed = value.trim()
    if (!trimmed) { setEditing(false); return }
    await fetch(`/api/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
    onUpdate(job.id, trimmed)
    setEditing(false)
  }

  function cancel(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.preventDefault()}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(e); if (e.key === 'Escape') setEditing(false) }}
          className="flex-1 text-xs bg-zinc-800 text-white rounded px-2 py-1 border border-zinc-600 outline-none min-w-0"
        />
        <button onClick={save} className="text-green-400 hover:text-green-300 p-0.5"><Check size={13} /></button>
        <button onClick={cancel} className="text-zinc-500 hover:text-zinc-300 p-0.5"><X size={13} /></button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 group/title">
      <p className="text-xs font-medium text-white truncate flex-1">
        {job.title || t(lang as 'zh' | 'en', UI.jobs.untitled)}
      </p>
      <button
        onClick={startEdit}
        className="opacity-0 group-hover/title:opacity-100 text-zinc-600 hover:text-zinc-400 transition-all p-0.5 shrink-0"
      >
        <Pencil size={11} />
      </button>
    </div>
  )
}

export default function WorksPage() {
  const lang = useLanguage()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')

  const dateLocale = lang === 'zh' ? zhCN : enUS
  const TYPE_LABEL = Object.fromEntries(
    Object.entries(UI.jobs.types).map(([k, v]) => [k, t(lang, v)])
  )

  useEffect(() => { fetchJobs() }, [])

  async function fetchJobs() {
    const res = await fetch('/api/jobs')
    const data = await res.json()
    // Only completed/failed, newest first
    const done = (Array.isArray(data) ? data : []).filter(
      (j: Job) => ['done', 'failed'].includes(j.status)
    )
    setJobs(done)
    setLoading(false)
  }

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(lang === 'zh' ? '确定删除该作品？' : 'Delete this work?')) return
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    setJobs(prev => prev.filter(j => j.id !== id))
  }

  function handleUpdate(id: number, title: string) {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, title } : j))
  }

  const filtered = typeFilter === 'all'
    ? jobs
    : jobs.filter(j => j.type === typeFilter)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          {lang === 'zh' ? '历史作品' : 'Works'}
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {lang === 'zh' ? '所有已完成的视频，按时间倒序' : 'All completed videos, newest first'}
        </p>
      </div>

      {/* 类型筛选 */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
              ${typeFilter === f.value
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
          >
            {lang === 'zh' ? f.zh : f.en}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-video rounded-xl bg-zinc-800 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <Film size={40} className="mx-auto mb-3 opacity-30" />
          <p>{lang === 'zh' ? '暂无作品' : 'No works yet'}</p>
          <Link href="/studio" className="text-sm text-violet-400 hover:text-violet-300 mt-2 inline-block">
            {lang === 'zh' ? '去内容创作' : 'Go to Studio'}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {filtered.map(job => (
            <Link key={job.id} href={`/jobs/${job.id}`}
              className="group rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 overflow-hidden transition-all">
              {/* 缩略图 */}
              <div className="aspect-video bg-zinc-800 flex items-center justify-center relative">
                {job.final_video_url ? (
                  <video src={job.final_video_url} className="w-full h-full object-cover" muted />
                ) : (
                  <Film size={24} className="text-zinc-700" />
                )}
                {job.status === 'failed' && (
                  <div className="absolute inset-0 bg-red-900/30 flex items-center justify-center">
                    <XCircle size={20} className="text-red-400" />
                  </div>
                )}
                {job.status === 'done' && (
                  <CheckCircle2 size={14} className="text-green-400 absolute top-2 right-2" />
                )}
                {/* 删除按钮（hover 才显示） */}
                <button
                  onClick={e => handleDelete(e, job.id)}
                  className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 p-1 rounded bg-zinc-900/80 text-zinc-400 hover:text-red-400 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              {/* 信息 */}
              <div className="p-2.5">
                <EditableTitle job={job} onUpdate={handleUpdate} lang={lang} />
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
    </div>
  )
}
