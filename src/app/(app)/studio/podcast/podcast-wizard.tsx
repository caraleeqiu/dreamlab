'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PLATFORMS, TOPIC_CATEGORIES } from '@/lib/language'
import type { Language, Influencer, ScriptClip } from '@/types'
import { t, UI } from '@/lib/i18n'

interface Topic { id: string; title: string; angle: string; source: string; date: string }
interface Props { lang: Language; credits: number; influencers: Influencer[]; initialMode?: 'trending' | 'import' | 'custom' }

export default function PodcastWizard({ lang, credits, influencers, initialMode }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Step 0
  const [topics, setTopics] = useState<Topic[]>([])
  const [trendTopics, setTrendTopics] = useState<Topic[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState(TOPIC_CATEGORIES[lang][0])
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([])
  const [customText, setCustomText] = useState('')
  const [inputMode, setInputMode] = useState<'trending' | 'custom'>(initialMode === 'custom' ? 'custom' : 'trending')

  // Step 1
  const [perspective, setPerspective] = useState('')
  const [keypoints, setKeypoints] = useState<string[]>([])
  const [selectedKps, setSelectedKps] = useState<number[]>([])
  const [customKp, setCustomKp] = useState('')

  // Step 2
  const [format, setFormat] = useState<'solo' | 'dialogue'>('dialogue')
  const [platform, setPlatform] = useState(PLATFORMS[lang][0].value)
  const [duration, setDuration] = useState(180)
  const [selectedInfluencers, setSelectedInfluencers] = useState<Influencer[]>([])

  // Step 3
  const [script, setScript] = useState<ScriptClip[]>([])

  // Step 4 (新增分镜)
  const [storyboard, setStoryboard] = useState<ScriptClip[]>([])

  const platforms = PLATFORMS[lang]
  const categories = TOPIC_CATEGORIES[lang]
  const aspectRatio = platforms.find(p => p.value === platform)?.aspectRatio ?? '9:16'

  // 从 trending 页跳来预填话题
  useEffect(() => {
    const title = searchParams.get('title')
    const angle = searchParams.get('angle')
    const source = searchParams.get('source')
    if (title) {
      const t: Topic = { id: 'prefill', title, angle: angle || '', source: source || '', date: '' }
      setSelectedTopics([t])
      setInputMode('trending')
    }
  }, [])

  // 加载热点
  useEffect(() => {
    if (inputMode === 'trending') fetchTrending(activeCategory)
  }, [activeCategory, inputMode])

  async function fetchTrending(category: string) {
    setTrendLoading(true)
    const res = await fetch(`/api/trending?lang=${lang}&category=${encodeURIComponent(category)}`)
    const data = await res.json()
    setTrendTopics(Array.isArray(data) ? data : [])
    setTrendLoading(false)
  }

  function toggleTopic(t: Topic) {
    setSelectedTopics(prev => {
      if (prev.find(p => p.id === t.id)) return prev.filter(p => p.id !== t.id)
      if (prev.length >= 2) return prev
      return [...prev, t]
    })
  }

  async function generateKeypoints() {
    setLoading(true)
    const topicsToSend = inputMode === 'custom'
      ? [{ title: customText, angle: '' }]
      : selectedTopics
    const res = await fetch('/api/studio/podcast/keypoints', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topics: topicsToSend, language: lang }),
    })
    const data = await res.json()
    setKeypoints(data.keypoints || [])
    setPerspective(data.perspective || '')
    setSelectedKps(data.keypoints?.map((_: string, i: number) => i) || [])
    setLoading(false)
  }

  async function generateScript() {
    setLoading(true)
    const chosenKps = keypoints.filter((_, i) => selectedKps.includes(i))
    const infToSend = selectedInfluencers.length > 0
      ? selectedInfluencers
      : format === 'dialogue'
        ? influencers.slice(0, 2)
        : [influencers[0]]

    const res = await fetch('/api/studio/podcast/script', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topics: inputMode === 'custom' ? [{ title: customText }] : selectedTopics,
        keypoints: chosenKps,
        perspective,
        format,
        platform,
        duration_s: duration,
        influencers: infToSend,
        language: lang,
      }),
    })
    const data = await res.json()
    setScript(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function generateStoryboard() {
    setLoading(true)
    const infToSend = selectedInfluencers.length > 0
      ? selectedInfluencers
      : format === 'dialogue'
        ? influencers.slice(0, 2)
        : [influencers[0]]

    const res = await fetch('/api/studio/storyboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: script.map(c => `[${c.speaker}]: ${c.dialogue}`).join('\n'),
        influencers: infToSend,
        platform,
        duration_s: duration,
        lang,
        job_type: 'podcast',
      }),
    })
    const data = await res.json()
    setStoryboard(Array.isArray(data.script) ? data.script : script)
    setLoading(false)
  }

  async function submitJob() {
    setLoading(true)
    const infToSend = selectedInfluencers.length > 0
      ? selectedInfluencers
      : format === 'dialogue'
        ? influencers.slice(0, 2)
        : [influencers[0]]

    const finalScript = storyboard.length > 0 ? storyboard : script

    const res = await fetch('/api/studio/podcast', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topics: inputMode === 'custom' ? [{ title: customText }] : selectedTopics,
        keypoints: finalScript.map(c => c.dialogue),
        perspective,
        format,
        platform,
        aspect_ratio: aspectRatio,
        duration_s: duration,
        influencer_ids: infToSend.map(i => i.id),
        script: finalScript,
        language: lang,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.job_id) router.push(`/jobs/${data.job_id}`)
  }

  const maxInfluencers = format === 'solo' ? 1 : 2
  function toggleInfluencer(inf: Influencer) {
    setSelectedInfluencers(prev => {
      if (prev.find(i => i.id === inf.id)) return prev.filter(i => i.id !== inf.id)
      if (prev.length >= maxInfluencers) return prev
      return [...prev, inf]
    })
  }

  const STEPS = UI.podcast.steps[lang]

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

      {/* Step 0: 选话题 */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['trending', 'custom'] as const).map(m => (
              <button key={m} onClick={() => setInputMode(m)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors
                  ${inputMode === m ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                {m === 'trending' ? t(lang, UI.podcast.trendingMode) : t(lang, UI.podcast.customMode)}
              </button>
            ))}
          </div>

          {inputMode === 'trending' ? (
            <>
              <div className="flex gap-2 flex-wrap">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors
                      ${activeCategory === cat ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>
                    {cat}
                  </button>
                ))}
              </div>
              {trendLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-zinc-800 animate-pulse" />
                ))}</div>
              ) : (
                <div className="space-y-2">
                  {trendTopics.map(t => {
                    const selected = selectedTopics.find(s => s.id === t.id)
                    const disabled = !selected && selectedTopics.length >= 2
                    return (
                      <button key={t.id} onClick={() => !disabled && toggleTopic(t)} disabled={disabled}
                        className={`w-full p-3 rounded-xl border text-left transition-all
                          ${selected ? 'border-violet-500 bg-violet-600/10' : disabled ? 'border-zinc-800 opacity-40' : 'border-zinc-800 hover:border-zinc-600'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-white">{t.title}</div>
                            <div className="text-xs text-zinc-500 mt-0.5">{t.angle}</div>
                            <div className="text-xs text-zinc-700 mt-1">{t.source} · {t.date}</div>
                          </div>
                          {selected && <Check size={15} className="text-violet-400 shrink-0 mt-0.5" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {selectedTopics.length > 0 && (
                <p className="text-xs text-zinc-500">{t(lang, UI.podcast.selected)} {selectedTopics.length}{t(lang, UI.podcast.topicsOf)}{selectedTopics.length === 2 ? t(lang, UI.podcast.topicsMerge) : ''}</p>
              )}
            </>
          ) : (
            <Textarea value={customText} onChange={e => setCustomText(e.target.value)}
              placeholder={t(lang, UI.podcast.customPlaceholder)}
              className="bg-zinc-800 border-zinc-700 text-white resize-none min-h-32" rows={6} />
          )}
        </div>
      )}

      {/* Step 1: 确认要点 */}
      {step === 1 && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3 text-zinc-500">
              <Loader2 size={24} className="animate-spin text-violet-400" />
              <span className="text-sm">{t(lang, UI.podcast.extracting)}</span>
            </div>
          ) : (
            <>
              {perspective && (
                <div className="p-3 rounded-lg bg-violet-600/10 border border-violet-800 text-sm text-violet-300">
                  <span className="font-medium">{t(lang, UI.podcast.perspective)}</span>{perspective}
                </div>
              )}
              <div className="space-y-2">
                {keypoints.map((kp, i) => (
                  <button key={i} onClick={() => setSelectedKps(prev =>
                    prev.includes(i) ? prev.filter(x => x !== i) : prev.length < 6 ? [...prev, i] : prev
                  )}
                    className={`w-full p-3 rounded-xl border text-left text-sm transition-all flex items-start gap-3
                      ${selectedKps.includes(i) ? 'border-violet-500 bg-violet-600/10 text-white' : 'border-zinc-800 text-zinc-400'}`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5
                      ${selectedKps.includes(i) ? 'bg-violet-600' : 'border border-zinc-600'}`}>
                      {selectedKps.includes(i) && <Check size={10} className="text-white" />}
                    </div>
                    {kp}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-600">{t(lang, UI.podcast.selected)} {selectedKps.length}{t(lang, UI.podcast.keypointsOf)}</p>
              <div className="flex gap-2">
                <Textarea value={customKp} onChange={e => setCustomKp(e.target.value)}
                  placeholder={t(lang, UI.podcast.addKpPlaceholder)} className="bg-zinc-800 border-zinc-700 text-white resize-none" rows={2} />
                {customKp && (
                  <Button onClick={() => { setKeypoints(prev => [...prev, customKp]); setSelectedKps(prev => [...prev, keypoints.length]); setCustomKp('') }}
                    variant="outline" className="shrink-0 border-zinc-700 text-zinc-400">{t(lang, UI.podcast.addKpBtn)}</Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 2: 节目设置 */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">{t(lang, UI.podcast.showType)}</label>
            <div className="flex gap-2">
              {(['solo', 'dialogue'] as const).map(f => (
                <button key={f} onClick={() => { setFormat(f); setSelectedInfluencers([]) }}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors
                    ${format === f ? 'border-violet-500 bg-violet-600/10 text-white' : 'border-zinc-700 text-zinc-400'}`}>
                  {f === 'solo' ? t(lang, UI.podcast.solo) : t(lang, UI.podcast.dialogue)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">{t(lang, UI.podcast.platform)}</label>
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
            {platforms.find(p => p.value === platform) && (
              <p className="text-xs text-zinc-600">{lang === 'zh' ? '建议时长：' : 'Suggested: '}{platforms.find(p => p.value === platform)?.durationHint}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">{t(lang, UI.podcast.duration)}</label>
            <div className="flex flex-wrap gap-2">
              {[60, 180, 300, 600].map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  className={`px-3.5 py-2 rounded-lg border text-sm transition-colors
                    ${duration === d ? 'border-violet-500 bg-violet-600/10 text-white' : 'border-zinc-700 text-zinc-400'}`}>
                  {d < 60 ? `${d}${t(lang, UI.podcast.durationSec)}` : `${d / 60}${t(lang, UI.podcast.durationMin)}`}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-600">{lang === 'zh' ? `约 ${Math.floor(duration / 15)} 个切片` : `~${Math.floor(duration / 15)} clips`}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">
              {t(lang, UI.podcast.pickInfluencer)}（{format === 'solo' ? (lang === 'zh' ? '选1个' : 'pick 1') : (lang === 'zh' ? '选2个' : 'pick 2')}）
              {selectedInfluencers.length === 0 && <span className="text-zinc-600 ml-1">{lang === 'zh' ? '不选则使用默认' : 'default if none selected'}</span>}
            </label>
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
              {influencers.map(inf => {
                const selected = selectedInfluencers.find(i => i.id === inf.id)
                const disabled = !selected && selectedInfluencers.length >= maxInfluencers
                return (
                  <button key={inf.id} onClick={() => !disabled && toggleInfluencer(inf)} disabled={disabled}
                    className={`p-2 rounded-lg border text-left text-xs transition-all
                      ${selected ? 'border-violet-500 bg-violet-600/10' : disabled ? 'border-zinc-800 opacity-40' : 'border-zinc-800 hover:border-zinc-600'}`}>
                    <div className="font-medium text-white">{inf.name}</div>
                    <div className="text-zinc-600 truncate">{inf.tagline}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: 预览脚本 */}
      {step === 3 && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3 text-zinc-500">
              <Loader2 size={24} className="animate-spin text-violet-400" />
              <span className="text-sm">{t(lang, UI.podcast.scriptLoading)}</span>
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-500">
                {lang === 'zh'
                  ? `${script.length} 个切片 · 约 ${Math.floor(script.length * 15 / 60)} 分钟 · 可编辑台词`
                  : `${script.length} clips · ~${Math.floor(script.length * 15 / 60)} min · editable`}
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {script.map((clip, i) => (
                  <div key={i} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-500">#{clip.index + 1}</span>
                      <span className="text-xs text-violet-400">{clip.speaker}</span>
                      <span className="text-xs text-zinc-700">{clip.duration}s</span>
                    </div>
                    <Textarea
                      value={clip.dialogue}
                      onChange={e => setScript(prev => prev.map((c, j) => j === i ? { ...c, dialogue: e.target.value } : c))}
                      className="bg-zinc-800 border-zinc-700 text-white text-sm resize-none"
                      rows={2}
                    />
                    <p className="text-xs text-zinc-700 mt-1 truncate">{clip.shot_description}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 4: 分镜预览（表格） */}
      {step === 4 && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3 text-zinc-500">
              <Loader2 size={24} className="animate-spin text-violet-400" />
              <span className="text-sm">{t(lang, UI.podcast.storyboardLoading)}</span>
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-500">
                {lang === 'zh'
                  ? `${storyboard.length} 个镜头 · 可返回上一步修改台词后重新生成`
                  : `${storyboard.length} shots · go back to edit dialogue`}
              </p>
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900">
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium w-8">#</th>
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium">{lang === 'zh' ? '说话人' : 'Speaker'}</th>
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium">{lang === 'zh' ? '景别' : 'Shot'}</th>
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium">{lang === 'zh' ? '运动' : 'Camera'}</th>
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium">{lang === 'zh' ? '台词' : 'Dialogue'}</th>
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium">BGM</th>
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium">{lang === 'zh' ? '旁白' : 'VO'}</th>
                      <th className="px-3 py-2 text-left text-zinc-500 font-medium w-8">{lang === 'zh' ? '时长' : 'Dur'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storyboard.map((clip, i) => (
                      <tr key={i} className={`border-b border-zinc-800/60 ${i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-900/50'}`}>
                        <td className="px-3 py-2 text-zinc-600">{clip.index + 1}</td>
                        <td className="px-3 py-2 text-violet-400">{clip.speaker}</td>
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
            <div className="flex justify-between"><span className="text-zinc-400">{lang === 'zh' ? '类型' : 'Type'}</span><span className="text-white">{format === 'solo' ? t(lang, UI.podcast.solo) : t(lang, UI.podcast.dialogue)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">{lang === 'zh' ? '平台' : 'Platform'}</span><span className="text-white">{platforms.find(p => p.value === platform)?.label} ({aspectRatio})</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">{lang === 'zh' ? '时长' : 'Duration'}</span><span className="text-white">~{Math.floor(duration / 60)} {t(lang, UI.podcast.durationMin)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">{lang === 'zh' ? '切片数' : 'Clips'}</span><span className="text-white">{storyboard.length || script.length}</span></div>
            <div className="flex justify-between font-medium"><span className="text-zinc-400">{lang === 'zh' ? '费用' : 'Cost'}</span><span className="text-violet-400">20 {t(lang, UI.common.credits)}</span></div>
          </div>
          {credits < 20 && (
            <p className="text-sm text-red-400">{t(lang, UI.podcast.insufficientCredits)} ({lang === 'zh' ? `当前 ${credits} 积分` : `current: ${credits}`})</p>
          )}
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex justify-between mt-8 pt-6 border-t border-zinc-800">
        <Button variant="ghost" onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
          className="text-zinc-400 hover:text-white">
          <ChevronLeft size={16} className="mr-1" />{step === 0 ? t(lang, UI.common.back) : t(lang, UI.common.prev)}
        </Button>

        {step === 0 && (
          <Button onClick={() => { setStep(1); generateKeypoints() }}
            disabled={inputMode === 'trending' ? selectedTopics.length === 0 : !customText.trim()}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {lang === 'zh' ? 'AI 提炼要点' : 'Extract Key Points'}
          </Button>
        )}
        {step === 1 && !loading && (
          <Button onClick={() => setStep(2)} disabled={selectedKps.length === 0}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {lang === 'zh' ? '下一步：节目设置' : 'Next: Setup'}
          </Button>
        )}
        {step === 2 && (
          <Button onClick={() => { setStep(3); generateScript() }}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {t(lang, UI.podcast.generateScriptBtn)}
          </Button>
        )}
        {step === 3 && !loading && (
          <Button onClick={() => { setStep(4); generateStoryboard() }} disabled={script.length === 0}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {t(lang, UI.podcast.generateStoryboardBtn)}
          </Button>
        )}
        {step === 4 && !loading && (
          <Button onClick={() => setStep(5)} disabled={storyboard.length === 0}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {lang === 'zh' ? '下一步：确认生成' : 'Next: Confirm'}
          </Button>
        )}
        {step === 5 && (
          <Button onClick={submitJob} disabled={loading || credits < 20}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {loading
              ? <><Loader2 size={14} className="animate-spin mr-1.5" />{lang === 'zh' ? '提交中...' : 'Submitting...'}</>
              : `${t(lang, UI.podcast.submitBtn)} (20 ${t(lang, UI.common.credits)})`}
          </Button>
        )}
      </div>
    </div>
  )
}
