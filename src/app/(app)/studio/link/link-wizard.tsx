'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PLATFORMS } from '@/lib/language'
import type { Language, Influencer, ScriptClip } from '@/types'

const STEPS = ['输入链接', '内容提取', '选网红', '节目设置', '分镜预览', '确认生成']

interface Props { lang: Language; credits: number; influencers: Influencer[] }

export default function LinkWizard({ lang, credits, influencers }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Step 0
  const [url, setUrl] = useState('')

  // Step 1
  const [extractedTitle, setExtractedTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [extractError, setExtractError] = useState('')

  // Step 2
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null)

  // Step 3
  const [platform, setPlatform] = useState(PLATFORMS[lang][0].value)
  const [duration, setDuration] = useState(180)

  // Step 4
  const [storyboard, setStoryboard] = useState<ScriptClip[]>([])

  const platforms = PLATFORMS[lang]
  const aspectRatio = platforms.find(p => p.value === platform)?.aspectRatio ?? '9:16'

  async function extractContent() {
    setLoading(true)
    setExtractError('')
    const res = await fetch('/api/studio/link/extract', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, language: lang }),
    })
    const data = await res.json()
    if (!res.ok) {
      setExtractError(data.error || '提取失败')
    } else {
      setExtractedTitle(data.title || '')
      setSummary(data.summary || '')
    }
    setLoading(false)
  }

  async function generateStoryboard() {
    setLoading(true)
    const inf = selectedInfluencer ?? influencers[0]
    const res = await fetch('/api/studio/storyboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: summary,
        influencers: inf ? [inf] : [],
        platform,
        duration_s: duration,
        lang,
        job_type: 'link',
      }),
    })
    const data = await res.json()
    setStoryboard(Array.isArray(data.script) ? data.script : [])
    setLoading(false)
  }

  async function submitJob() {
    setLoading(true)
    const inf = selectedInfluencer ?? influencers[0]
    const res = await fetch('/api/studio/link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: extractedTitle || url,
        source_url: url,
        platform,
        aspect_ratio: aspectRatio,
        duration_s: duration,
        influencer_ids: inf ? [inf.id] : [],
        script: storyboard,
        language: lang,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.job_id) router.push(`/jobs/${data.job_id}`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* 步骤指示 */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors
                ${i < step ? 'bg-violet-600 text-white' : i === step ? 'bg-violet-600 text-white ring-2 ring-violet-400/30' : 'bg-zinc-800 text-zinc-600'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs mt-1 whitespace-nowrap ${i === step ? 'text-white' : 'text-zinc-600'}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-1 mb-4 ${i < step ? 'bg-violet-600' : 'bg-zinc-800'}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: 输入链接 */}
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">粘贴文章或网页链接，AI自动提炼内容并生成视频。</p>
          <div className="space-y-1">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="text-xs text-zinc-600 space-y-1">
            <p>支持：普通网页文章、知乎、YouTube（仅标题+描述）</p>
            <p>微信公众号文章可能需要手动复制正文，改用「自定义脚本」</p>
          </div>
        </div>
      )}

      {/* Step 1: 内容提取 */}
      {step === 1 && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3 text-zinc-500">
              <Loader2 size={24} className="animate-spin text-violet-400" />
              <span className="text-sm">正在抓取并提炼内容...</span>
            </div>
          ) : extractError ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-900/20 border border-red-800 flex gap-3">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div className="text-sm text-red-400">{extractError}</div>
              </div>
              <Button onClick={extractContent} variant="outline" className="border-zinc-700 text-zinc-400 w-full">
                <RefreshCw size={14} className="mr-1.5" /> 重试
              </Button>
            </div>
          ) : (
            <>
              {extractedTitle && (
                <div className="text-sm font-medium text-white">{extractedTitle}</div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400">AI 提炼摘要，可编辑</p>
                <Button variant="ghost" size="sm" onClick={extractContent}
                  className="text-zinc-500 hover:text-white text-xs gap-1">
                  <RefreshCw size={12} /> 重新提取
                </Button>
              </div>
              <Textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white resize-none min-h-48"
                rows={10}
              />
              <p className="text-xs text-zinc-600">{summary.length} 字</p>
            </>
          )}
        </div>
      )}

      {/* Step 2: 选网红 */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">选择一个网红主持此内容</p>
          <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
            {influencers.map(inf => {
              const selected = selectedInfluencer?.id === inf.id
              return (
                <button key={inf.id} onClick={() => setSelectedInfluencer(inf)}
                  className={`p-3 rounded-lg border text-left transition-all
                    ${selected ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-800 hover:border-zinc-600'}`}>
                  <div className="font-medium text-white text-sm">{inf.name}</div>
                  <div className="text-zinc-500 text-xs mt-0.5 truncate">{inf.tagline}</div>
                </button>
              )
            })}
          </div>
          {!selectedInfluencer && (
            <p className="text-xs text-zinc-600">不选则使用默认第一位网红</p>
          )}
        </div>
      )}

      {/* Step 3: 节目设置 */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">发布平台</label>
            <div className="flex flex-wrap gap-2">
              {platforms.map(p => (
                <button key={p.value} onClick={() => setPlatform(p.value)}
                  className={`px-3.5 py-2 rounded-lg border text-sm transition-colors
                    ${platform === p.value ? 'border-violet-500 bg-violet-600/10 text-white' : 'border-zinc-700 text-zinc-400 hover:text-white'}`}>
                  {p.label}
                  <span className="ml-1 text-xs text-zinc-600">{p.aspectRatio}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">视频时长</label>
            <div className="flex flex-wrap gap-2">
              {[60, 180, 300, 600].map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  className={`px-3.5 py-2 rounded-lg border text-sm transition-colors
                    ${duration === d ? 'border-violet-500 bg-violet-600/10 text-white' : 'border-zinc-700 text-zinc-400'}`}>
                  {d < 60 ? `${d}s` : `${d / 60}分钟`}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-600">约 {Math.floor(duration / 15)} 个切片</p>
          </div>
        </div>
      )}

      {/* Step 4: 分镜预览（表格） */}
      {step === 4 && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3 text-zinc-500">
              <Loader2 size={24} className="animate-spin text-violet-400" />
              <span className="text-sm">AI 生成分镜中...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">{storyboard.length} 个镜头</p>
                <Button variant="ghost" size="sm" onClick={generateStoryboard}
                  className="text-zinc-500 hover:text-white text-xs gap-1">
                  <RefreshCw size={12} /> 重新生成
                </Button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900">
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium w-8">#</th>
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium">景别</th>
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium">运动</th>
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium">台词</th>
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium">BGM</th>
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium">旁白</th>
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium w-8">时长</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storyboard.map((clip, i) => (
                      <tr key={i} className={`border-b border-zinc-800/60 ${i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-900/50'}`}>
                        <td className="px-3 py-2 text-zinc-600">{clip.index + 1}</td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">{clip.shot_type || '—'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">{clip.camera_movement || '—'}</span>
                        </td>
                        <td className="px-3 py-2 text-white max-w-48">
                          <span className="line-clamp-2">{clip.dialogue}</span>
                        </td>
                        <td className="px-3 py-2 text-zinc-400">{clip.bgm || '—'}</td>
                        <td className="px-3 py-2 text-zinc-500 max-w-32">
                          <span className="line-clamp-1">{clip.voiceover || '—'}</span>
                        </td>
                        <td className="px-3 py-2 text-zinc-600">{clip.duration}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 5: 确认生成 */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-zinc-800 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">来源</span><span className="text-white truncate max-w-48 text-right">{extractedTitle || url}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">网红</span><span className="text-white">{selectedInfluencer?.name ?? influencers[0]?.name}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">平台</span><span className="text-white">{platforms.find(p => p.value === platform)?.label} ({aspectRatio})</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">时长</span><span className="text-white">约 {Math.floor(duration / 60)} 分钟</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">切片数</span><span className="text-white">{storyboard.length} 个</span></div>
            <div className="flex justify-between font-medium"><span className="text-zinc-400">费用</span><span className="text-violet-400">15 积分</span></div>
          </div>
          {credits < 15 && (
            <p className="text-sm text-red-400">积分不足（当前 {credits} 积分），请先充值</p>
          )}
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex justify-between mt-8 pt-6 border-t border-zinc-800">
        <Button variant="ghost" onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
          className="text-zinc-400 hover:text-white">
          <ChevronLeft size={16} className="mr-1" />{step === 0 ? '返回' : '上一步'}
        </Button>

        {step === 0 && (
          <Button onClick={() => { setStep(1); extractContent() }}
            disabled={!url.trim() || !url.startsWith('http')}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            提取内容
          </Button>
        )}
        {step === 1 && !loading && !extractError && (
          <Button onClick={() => setStep(2)} disabled={!summary.trim()}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            下一步：选网红
          </Button>
        )}
        {step === 2 && (
          <Button onClick={() => setStep(3)}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            下一步：节目设置
          </Button>
        )}
        {step === 3 && (
          <Button onClick={() => { setStep(4); generateStoryboard() }}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            AI 生成分镜
          </Button>
        )}
        {step === 4 && !loading && (
          <Button onClick={() => setStep(5)} disabled={storyboard.length === 0}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            下一步：确认生成
          </Button>
        )}
        {step === 5 && (
          <Button onClick={submitJob} disabled={loading || credits < 15}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {loading ? <><Loader2 size={14} className="animate-spin mr-1.5" />提交中...</> : '确认生成 (15积分)'}
          </Button>
        )}
      </div>
    </div>
  )
}
