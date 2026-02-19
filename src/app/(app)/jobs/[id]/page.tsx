'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Loader2, CheckCircle2, XCircle, Sparkles, Copy, RefreshCw, Pencil, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Job, Clip } from '@/types'
import { useLanguage } from '@/context/language-context'
import { t, UI } from '@/lib/i18n'

interface PublishKit {
  caption: string
  hashtags: string
  bestPostTime: string
  hookAdvice: string
}

const STATUS_STEPS = ['pending', 'scripting', 'generating', 'lipsync', 'stitching', 'done']

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const lang = useLanguage()
  const [job, setJob] = useState<(Job & { clips?: Clip[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishKit, setPublishKit] = useState<PublishKit | null>(null)
  const [loadingKit, setLoadingKit] = useState(false)
  const [copied, setCopied] = useState('')
  const [editingClipId, setEditingClipId] = useState<number | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [keepSound, setKeepSound] = useState(true)
  const [editSubmitting, setEditSubmitting] = useState(false)

  async function generatePublishKit() {
    if (!job) return
    setLoadingKit(true)
    try {
      const res = await fetch('/api/studio/story/publish-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })
      const data = await res.json()
      setPublishKit(data)
    } finally {
      setLoadingKit(false)
    }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  async function submitClipEdit(clipId: number) {
    if (!editPrompt.trim()) return
    setEditSubmitting(true)
    try {
      const res = await fetch('/api/studio/edit-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_id: clipId, edit_prompt: editPrompt, keep_sound: keepSound }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || (lang === 'zh' ? '提交失败' : 'Submit failed'))
        return
      }
      setEditingClipId(null)
      setEditPrompt('')
      // Refresh job data — clip is now submitted, job is generating
      await fetchJob()
    } finally {
      setEditSubmitting(false)
    }
  }

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
    // 初始拉取完整 job 数据（含 clips 数组）
    fetchJob()

    // SSE 实时状态推送（替代 10s 轮询）
    const es = new EventSource(`/api/jobs/${id}/stream`)
    es.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setJob(prev => prev ? { ...prev, ...data } : prev)
    }
    // 服务端关闭连接（job 完成/失败/超时）时 onerror 触发，正常关闭即可
    es.onerror = () => es.close()

    return () => es.close()
  }, [id])

  async function fetchJob() {
    const res = await fetch(`/api/jobs/${id}`)
    const data = await res.json()
    setJob(data)
    setLoading(false)
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
      {job.series_name && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900/40 border border-violet-700/40 text-violet-400">
            《{job.series_name}》{lang === 'zh' ? `第${job.episode_number}集` : `Ep ${job.episode_number}`}
          </span>
          {job.cliffhanger && (
            <span className="text-xs text-zinc-500 italic truncate max-w-xs">
              {lang === 'zh' ? '悬念：' : 'Cliffhanger: '}"{job.cliffhanger}"
            </span>
          )}
        </div>
      )}
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

      {/* 失败面板 */}
      {isFailed && (
        <div className="mb-8 p-4 rounded-xl border border-red-800/50 bg-red-900/10 space-y-3">
          <div className="flex items-start gap-3">
            <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-400">
                {lang === 'zh' ? '视频生成失败' : 'Video generation failed'}
              </p>
              {job.error_msg && (
                <p className="text-xs text-red-500/70">{job.error_msg}</p>
              )}
              {job.credit_cost > 0 && (
                <p className="text-xs text-zinc-400">
                  {lang === 'zh'
                    ? `✓ 已退还 ${job.credit_cost} 积分`
                    : `✓ ${job.credit_cost} credits refunded`}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => router.push(`/studio/${job.type ?? 'story'}`)}
              className="bg-violet-600 hover:bg-violet-700 text-white text-xs"
            >
              <RefreshCw size={12} className="mr-1.5" />
              {lang === 'zh' ? '重新创建' : 'Create again'}
            </Button>
          </div>
        </div>
      )}

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
                    <div className="flex items-center justify-between">
                      <a href={clip.lipsync_url || clip.video_url} download
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors">
                        <Download size={11} /> {t(lang, UI.jobs.downloadClip)} {clip.clip_index + 1}
                      </a>
                      <button
                        onClick={() => {
                          if (editingClipId === clip.id) {
                            setEditingClipId(null)
                          } else {
                            setEditingClipId(clip.id)
                            setEditPrompt('')
                          }
                        }}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-400 transition-colors"
                      >
                        <Pencil size={11} />
                        {lang === 'zh' ? '编辑' : 'Edit'}
                      </button>
                    </div>

                    {/* Inline edit panel */}
                    {editingClipId === clip.id && (
                      <div className="mt-1 p-3 rounded-lg bg-zinc-800/80 border border-zinc-700 space-y-2">
                        <textarea
                          rows={2}
                          placeholder={lang === 'zh'
                            ? '描述修改意图，例如：把背景换成咖啡馆、让角色挥手...'
                            : 'Describe the edit, e.g. change background to a café, make character wave...'}
                          value={editPrompt}
                          onChange={e => setEditPrompt(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2.5 py-1.5 text-white placeholder:text-zinc-600 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setKeepSound(s => !s)}
                            className={`flex items-center gap-1.5 text-xs transition-colors ${keepSound ? 'text-violet-400' : 'text-zinc-500'}`}
                          >
                            {keepSound ? <Volume2 size={12} /> : <VolumeX size={12} />}
                            {lang === 'zh'
                              ? (keepSound ? '保留原音' : '静音')
                              : (keepSound ? 'Keep audio' : 'Mute')}
                          </button>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingClipId(null)}
                              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              {lang === 'zh' ? '取消' : 'Cancel'}
                            </button>
                            <Button
                              size="sm"
                              onClick={() => submitClipEdit(clip.id)}
                              disabled={editSubmitting || !editPrompt.trim()}
                              className="h-6 px-3 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                            >
                              {editSubmitting
                                ? <Loader2 size={11} className="animate-spin" />
                                : (lang === 'zh' ? '提交编辑' : 'Submit')}
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-600">
                          {lang === 'zh'
                            ? '使用 Kling v3-omni 编辑，完成后自动重新合成视频'
                            : 'Edited via Kling v3-omni. Final video re-stitches automatically.'}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 发布包 — 仅 story 类型完成后显示 */}
      {isDone && job.type === 'story' && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">{lang === 'zh' ? '发布包' : 'Publish Kit'}</h2>
            {!publishKit && (
              <Button onClick={generatePublishKit} disabled={loadingKit} size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white text-xs">
                {loadingKit
                  ? <><Loader2 size={12} className="animate-spin mr-1" />{lang === 'zh' ? '生成中...' : 'Generating...'}</>
                  : <><Sparkles size={12} className="mr-1" />{lang === 'zh' ? '生成发布包' : 'Generate Kit'}</>}
              </Button>
            )}
          </div>
          {publishKit && (
            <div className="space-y-3">
              {[
                { key: 'caption',      label: lang === 'zh' ? '正文 Caption' : 'Caption',        value: publishKit.caption },
                { key: 'hashtags',     label: lang === 'zh' ? '话题标签'     : 'Hashtags',        value: publishKit.hashtags },
                { key: 'bestPostTime', label: lang === 'zh' ? '最佳发布时间' : 'Best Post Time',  value: publishKit.bestPostTime },
                { key: 'hookAdvice',   label: lang === 'zh' ? '算法建议'     : 'Algorithm Tip',   value: publishKit.hookAdvice },
              ].map(item => (
                <div key={item.key} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-zinc-500">{item.label}</span>
                    <button onClick={() => copyText(item.value, item.key)}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors">
                      <Copy size={11} />
                      {copied === item.key ? (lang === 'zh' ? '已复制' : 'Copied!') : (lang === 'zh' ? '复制' : 'Copy')}
                    </button>
                  </div>
                  <p className="text-sm text-zinc-200 leading-relaxed">{item.value}</p>
                </div>
              ))}
              <button onClick={() => setPublishKit(null)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                {lang === 'zh' ? '重新生成' : 'Regenerate'}
              </button>
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
