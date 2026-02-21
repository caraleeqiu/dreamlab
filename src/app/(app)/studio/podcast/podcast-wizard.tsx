'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, Check, Upload, FileText, X, RefreshCw, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { PLATFORMS, TOPIC_CATEGORIES } from '@/lib/language'
import type { Language, Influencer, ScriptClip } from '@/types'
import { t, UI } from '@/lib/i18n'

interface Topic { id: string; title: string; angle: string; source: string; date: string }
interface Concept { title: string; summary: string }
interface Props { lang: Language; credits: number; influencers: Influencer[]; initialMode?: 'trending' | 'url' | 'pdf' | 'write'; initialPrefs?: Record<string, unknown> }

export default function PodcastWizard({ lang, credits, influencers, initialMode, initialPrefs = {} }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Step 0 — mode (4 tabs)
  const [inputMode, setInputMode] = useState<'trending' | 'write' | 'url' | 'pdf'>(
    initialMode === 'url' ? 'url' : initialMode === 'pdf' ? 'pdf' : initialMode === 'write' ? 'write' : 'trending'
  )

  // Step 0 — trending
  const [trendTopics, setTrendTopics] = useState<Topic[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState(TOPIC_CATEGORIES[lang][0])
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([])
  const [trendingIdea, setTrendingIdea] = useState('') // conversation input on trending tab

  // Step 0 — write
  const [customText, setCustomText] = useState('')

  // Step 0 — url / pdf
  const [importUrl, setImportUrl] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)

  // Step 1 — trending/custom keypoints
  const [perspective, setPerspective] = useState('')
  const [keypoints, setKeypoints] = useState<string[]>([])
  const [selectedKps, setSelectedKps] = useState<number[]>([])
  const [customKp, setCustomKp] = useState('')

  // Step 1 — import concepts
  const [extractedTitle, setExtractedTitle] = useState('')
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [selectedConcepts, setSelectedConcepts] = useState<number[]>([])

  // Step 2 — pre-filled from saved preferences
  const [format, setFormat] = useState<'solo' | 'dialogue'>((initialPrefs.format as 'solo' | 'dialogue') ?? 'dialogue')
  const [platform, setPlatform] = useState((initialPrefs.platform as string) ?? PLATFORMS[lang][0].value)
  const [duration, setDuration] = useState((initialPrefs.duration as number) ?? 180)
  const [selectedInfluencers, setSelectedInfluencers] = useState<Influencer[]>([])

  // Step 3
  const [script, setScript] = useState<ScriptClip[]>([])

  // Step 4
  const [storyboard, setStoryboard] = useState<ScriptClip[]>([])
  const [previewImages, setPreviewImages] = useState<Record<number, string | null>>({})
  const [previewLoading, setPreviewLoading] = useState<Record<number, boolean>>({})
  const [previewError, setPreviewError] = useState<string>('')

  const platforms = PLATFORMS[lang]
  const categories = TOPIC_CATEGORIES[lang]
  const aspectRatio = platforms.find(p => p.value === platform)?.aspectRatio ?? '9:16'

  // Prefill from trending page deep-link
  useEffect(() => {
    const title = searchParams.get('title')
    const angle = searchParams.get('angle')
    const source = searchParams.get('source')
    if (title) {
      const topic: Topic = { id: 'prefill', title, angle: angle || '', source: source || '', date: '' }
      setSelectedTopics([topic])
      setInputMode('trending')
    }
  }, [])

  useEffect(() => {
    if (inputMode === 'trending') fetchTrending(activeCategory)
  }, [activeCategory, inputMode])

  // Source hints for URL tab
  const sourceHintsZh = {
    supported: ['任意文章链接', '知乎', '微博', 'Twitter / X（单条推文）'],
    unsupported: [
      { name: '微信公众号', tip: '复制正文后使用「自己写」' },
      { name: '小红书', tip: '需登录，复制内容后使用「自己写」' },
      { name: '视频链接（B站、抖音）', tip: '复制文案后使用「自己写」' },
    ],
  }
  const sourceHintsEn = {
    supported: ['Any article URL', 'Medium / Substack', 'Hacker News', 'Twitter / X (single tweet)'],
    unsupported: [
      { name: 'WeChat articles', tip: 'Copy text → use Write mode' },
      { name: 'Xiaohongshu', tip: 'Requires login → copy text → Write mode' },
      { name: 'Video links (YouTube, TikTok)', tip: 'Copy description → Write mode' },
    ],
  }
  const sourceHints = lang === 'zh' ? sourceHintsZh : sourceHintsEn

  async function fetchTrending(category: string) {
    setTrendLoading(true)
    const res = await fetch(`/api/trending?lang=${lang}&category=${encodeURIComponent(category)}`)
    const data = await res.json()
    setTrendTopics(Array.isArray(data) ? data : [])
    setTrendLoading(false)
  }

  function toggleTopic(topic: Topic) {
    setSelectedTopics(prev => {
      if (prev.find(p => p.id === topic.id)) return prev.filter(p => p.id !== topic.id)
      if (prev.length >= 2) return prev
      return [...prev, topic]
    })
  }

  // Extract concepts from URL or PDF
  async function extractConcepts() {
    setLoading(true)
    const fd = new FormData()
    fd.append('language', lang)
    if (inputMode === 'url') {
      fd.append('url', importUrl.trim())
    } else if (inputMode === 'pdf' && importFile) {
      fd.append('file', importFile)
    }
    const res = await fetch('/api/studio/podcast/extract', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.error) {
      setLoading(false)
      // If the platform suggests falling back to write mode, switch automatically
      if (data.fallback === 'write') {
        setInputMode('write')
        setCustomText('')
      }
      setStep(0)
      alert(data.error)
      return
    }
    setExtractedTitle(data.source_title || '')
    setConcepts(data.concepts || [])
    // Pre-select all (user can deselect)
    setSelectedConcepts((data.concepts || []).map((_: Concept, i: number) => i).slice(0, 6))
    setLoading(false)
  }

  // Extract keypoints from trending or write text
  async function generateKeypoints() {
    setLoading(true)
    const topicsToSend = inputMode === 'write'
      ? [{ title: customText, angle: '' }]
      : selectedTopics.map((t, i) =>
          i === 0 && trendingIdea.trim() ? { ...t, angle: trendingIdea.trim() } : t
        )
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
    const isImportMode = inputMode === 'url' || inputMode === 'pdf'
    const chosenKps = isImportMode
      ? selectedConcepts.map(i => `${concepts[i].title}: ${concepts[i].summary}`)
      : keypoints.filter((_, i) => selectedKps.includes(i))

    const topicsToSend = isImportMode
      ? [{ title: extractedTitle, angle: 'book-extract' }]
      : inputMode === 'write'
        ? [{ title: customText }]
        : selectedTopics

    const infToSend = selectedInfluencers.length > 0
      ? selectedInfluencers
      : format === 'dialogue' ? influencers.slice(0, 2) : [influencers[0]]

    const res = await fetch('/api/studio/podcast/script', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topics: topicsToSend,
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
    setPreviewImages({}) // Clear old previews
    const infToSend = selectedInfluencers.length > 0
      ? selectedInfluencers
      : format === 'dialogue' ? influencers.slice(0, 2) : [influencers[0]]

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
    const newStoryboard = Array.isArray(data.script) ? data.script : script
    setStoryboard(newStoryboard)
    setLoading(false)
    // Generate preview images in background
    generateAllPreviews(newStoryboard)
  }

  function updateStoryboardDialogue(index: number, value: string) {
    setStoryboard(prev => prev.map((clip, i) => i === index ? { ...clip, dialogue: value } : clip))
  }

  function updateStoryboardShotDesc(index: number, value: string) {
    setStoryboard(prev => prev.map((clip, i) => i === index ? { ...clip, shot_description: value } : clip))
  }

  // Generate all preview images
  async function generateAllPreviews(clips: ScriptClip[]) {
    if (!clips.length) return
    setPreviewError('')
    // Mark all as loading
    setPreviewLoading(Object.fromEntries(clips.map(c => [c.index, true])))

    const infToSend = selectedInfluencers.length > 0
      ? selectedInfluencers
      : format === 'dialogue' ? influencers.slice(0, 2) : [influencers[0]]
    const styleAnchor = infToSend[0]
      ? `${infToSend[0].name}, ${infToSend[0].tagline}, professional podcast host, warm studio lighting`
      : 'professional podcast host, warm studio lighting'

    try {
      const res = await fetch('/api/studio/storyboard/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clips: clips.map(c => ({
            index: c.index,
            shot_description: c.shot_description,
            consistency_anchor: c.consistency_anchor,
          })),
          styleAnchor,
          aspectRatio,
        }),
      })
      const data = await res.json()
      if (data.warning) {
        setPreviewError(data.warning)
      }
      if (data.previews) {
        const newPreviews: Record<number, string | null> = {}
        for (const p of data.previews) {
          newPreviews[p.index] = p.url
        }
        setPreviewImages(prev => ({ ...prev, ...newPreviews }))
      }
    } catch (err) {
      console.error('Preview generation error:', err)
      setPreviewError(lang === 'zh' ? '预览图生成失败' : 'Preview generation failed')
    } finally {
      setPreviewLoading({})
    }
  }

  // Regenerate single preview image
  async function regeneratePreview(clipIndex: number) {
    const clip = storyboard.find(c => c.index === clipIndex)
    if (!clip) return

    setPreviewLoading(prev => ({ ...prev, [clipIndex]: true }))

    const infToSend = selectedInfluencers.length > 0
      ? selectedInfluencers
      : format === 'dialogue' ? influencers.slice(0, 2) : [influencers[0]]
    const styleAnchor = infToSend[0]
      ? `${infToSend[0].name}, ${infToSend[0].tagline}, professional podcast host, warm studio lighting`
      : 'professional podcast host, warm studio lighting'

    try {
      const res = await fetch('/api/studio/storyboard/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clips: [{
            index: clip.index,
            shot_description: clip.shot_description,
            consistency_anchor: clip.consistency_anchor,
          }],
          styleAnchor,
          aspectRatio,
        }),
      })
      const data = await res.json()
      if (data.previews?.[0]) {
        setPreviewImages(prev => ({ ...prev, [clipIndex]: data.previews[0].url }))
      }
    } catch {
      // silent fail for single regeneration
    } finally {
      setPreviewLoading(prev => ({ ...prev, [clipIndex]: false }))
    }
  }

  async function submitJob() {
    setLoading(true)
    const infToSend = selectedInfluencers.length > 0
      ? selectedInfluencers
      : format === 'dialogue' ? influencers.slice(0, 2) : [influencers[0]]

    const finalScript = storyboard.length > 0 ? storyboard : script

    const topicsForSubmit = (inputMode === 'url' || inputMode === 'pdf')
      ? [{ title: extractedTitle }]
      : inputMode === 'write'
        ? [{ title: customText }]
        : selectedTopics

    const res = await fetch('/api/studio/podcast', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topics: topicsForSubmit,
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

  function savePrefs() {
    fetch('/api/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'podcast', prefs: { platform, duration, format } }),
    }).catch(() => { /* silent — non-critical */ })
  }

  function toggleConcept(i: number) {
    setSelectedConcepts(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : prev.length < 6 ? [...prev, i] : prev
    )
  }

  const STEPS = UI.podcast.steps[lang]

  // Step 0 next button disabled logic
  const step0Disabled =
    inputMode === 'trending' ? selectedTopics.length === 0
    : inputMode === 'url' ? !importUrl.trim()
    : inputMode === 'pdf' ? !importFile
    : !customText.trim()

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
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

      {/* ── Step 0: 选话题 / 输入内容 ── */}
      {step === 0 && (
        <div className="space-y-4">
          {/* Mode tabs — 4 entries */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'trending', label: lang === 'zh' ? '🔥 热点' : '🔥 Trending' },
              { key: 'write',    label: lang === 'zh' ? '✍️ 自己写' : '✍️ Write' },
              { key: 'url',      label: lang === 'zh' ? '🔗 链接' : '🔗 URL' },
              { key: 'pdf',      label: lang === 'zh' ? '📄 PDF' : '📄 PDF' },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setInputMode(key)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors
                  ${inputMode === key ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Trending: topic list + conversation input simultaneously */}
          {inputMode === 'trending' && (
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
                  {trendTopics.map(topic => {
                    const selected = selectedTopics.find(s => s.id === topic.id)
                    const disabled = !selected && selectedTopics.length >= 2
                    return (
                      <button key={topic.id} onClick={() => !disabled && toggleTopic(topic)} disabled={disabled}
                        className={`w-full p-3 rounded-xl border text-left transition-all
                          ${selected ? 'border-violet-500 bg-violet-600/10' : disabled ? 'border-zinc-800 opacity-40' : 'border-zinc-800 hover:border-zinc-600'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-white">{topic.title}</div>
                            <div className="text-xs text-zinc-500 mt-0.5">{topic.angle}</div>
                            <div className="text-xs text-zinc-700 mt-1">{topic.source} · {topic.date}</div>
                          </div>
                          {selected && <Check size={15} className="text-violet-400 shrink-0 mt-0.5" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {selectedTopics.length > 0 && (
                <p className="text-xs text-zinc-500">
                  {t(lang, UI.podcast.selected)} {selectedTopics.length}{t(lang, UI.podcast.topicsOf)}
                  {selectedTopics.length === 2 ? t(lang, UI.podcast.topicsMerge) : ''}
                </p>
              )}
              {/* Conversation input: ask what angle they want */}
              <div className="pt-2 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1.5">
                  {lang === 'zh' ? '你想聊什么角度？（可选，留空 AI 自动判断）' : 'What angle do you want? (optional, AI will decide if blank)'}
                </p>
                <Textarea
                  value={trendingIdea}
                  onChange={e => setTrendingIdea(e.target.value)}
                  placeholder={lang === 'zh'
                    ? '例：从职场人的视角，聊聊这件事对普通人的影响...'
                    : 'e.g. From a career perspective, how does this affect everyday people...'}
                  className="bg-zinc-800 border-zinc-700 text-white resize-none text-sm"
                  rows={2}
                />
              </div>
            </>
          )}

          {/* Write: simple textarea */}
          {inputMode === 'write' && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">
                {lang === 'zh'
                  ? '粘贴文章内容、书摘、脚本大纲，或者直接写你想聊的内容'
                  : 'Paste article text, book excerpts, script outline, or just write what you want to discuss'}
              </p>
              <Textarea value={customText} onChange={e => setCustomText(e.target.value)}
                placeholder={t(lang, UI.podcast.customPlaceholder)}
                className="bg-zinc-800 border-zinc-700 text-white resize-none min-h-32" rows={7} />
            </div>
          )}

          {/* URL: input + source hints */}
          {inputMode === 'url' && (
            <div className="space-y-3">
              <Input
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                placeholder="https://..."
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
              />
              {/* Source hints — zh and en separated */}
              <div className="rounded-xl border border-zinc-800 p-3 space-y-2 text-xs">
                <div>
                  <p className="text-zinc-400 font-medium mb-1">
                    {lang === 'zh' ? '✅ 支持的来源' : '✅ Supported sources'}
                  </p>
                  <ul className="space-y-0.5">
                    {sourceHints.supported.map(s => (
                      <li key={s} className="text-zinc-500 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="border-t border-zinc-800 pt-2">
                  <p className="text-zinc-400 font-medium mb-1">
                    {lang === 'zh' ? '❌ 不支持的来源' : '❌ Unsupported sources'}
                  </p>
                  <ul className="space-y-0.5">
                    {sourceHints.unsupported.map(s => (
                      <li key={s.name} className="text-zinc-600 flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-zinc-700 shrink-0 mt-1.5" />
                        <span>
                          <span className="text-zinc-500">{s.name}</span>
                          <span className="ml-1 text-zinc-700">— {s.tip}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* PDF: upload area */}
          {inputMode === 'pdf' && (
            <label className="flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed border-zinc-700 cursor-pointer hover:border-zinc-500 transition-colors">
              <input type="file" accept=".pdf" className="hidden"
                onChange={e => setImportFile(e.target.files?.[0] || null)} />
              {importFile ? (
                <div className="text-center">
                  <FileText size={22} className="mx-auto mb-2 text-violet-400" />
                  <p className="text-sm text-white">{importFile.name}</p>
                  <p className="text-xs text-zinc-500 mt-1">{(importFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  <button
                    onClick={e => { e.preventDefault(); setImportFile(null) }}
                    className="mt-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 mx-auto transition-colors">
                    <X size={11} /> {lang === 'zh' ? '移除' : 'Remove'}
                  </button>
                </div>
              ) : (
                <div className="text-center text-zinc-500">
                  <Upload size={22} className="mx-auto mb-2" />
                  <p className="text-sm">{lang === 'zh' ? '点击上传 PDF' : 'Click to upload PDF'}</p>
                  <p className="text-xs mt-1 text-zinc-600">{lang === 'zh' ? '最大 50MB' : 'Max 50MB'}</p>
                </div>
              )}
            </label>
          )}
        </div>
      )}

      {/* ── Step 1: 观点提炼 ── */}
      {step === 1 && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3 text-zinc-500">
              <Loader2 size={24} className="animate-spin text-violet-400" />
              <span className="text-sm">
                {(inputMode === 'url' || inputMode === 'pdf')
                  ? (lang === 'zh' ? 'AI 正在读取并提炼核心观点...' : 'AI is reading and extracting concepts...')
                  : t(lang, UI.podcast.extracting)}
              </span>
            </div>
          ) : (inputMode === 'url' || inputMode === 'pdf') ? (
            /* Import mode: rich concept cards */
            <>
              {extractedTitle && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-800 text-sm">
                  <FileText size={14} className="text-violet-400 shrink-0" />
                  <span className="text-zinc-300 truncate">{extractedTitle}</span>
                </div>
              )}
              <p className="text-xs text-zinc-500">
                {lang === 'zh'
                  ? `已提炼 ${concepts.length} 个核心观点，选择想聊的（最多 6 个）`
                  : `Extracted ${concepts.length} core concepts — pick up to 6 to cover`}
              </p>
              <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                {concepts.map((concept, i) => (
                  <button key={i} onClick={() => toggleConcept(i)}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3
                      ${selectedConcepts.includes(i) ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-800 hover:border-zinc-700'}`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5
                      ${selectedConcepts.includes(i) ? 'bg-violet-600' : 'border border-zinc-600'}`}>
                      {selectedConcepts.includes(i) && <Check size={10} className="text-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium leading-snug ${selectedConcepts.includes(i) ? 'text-white' : 'text-zinc-300'}`}>
                        {concept.title}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{concept.summary}</p>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-600">
                {lang === 'zh' ? `已选 ${selectedConcepts.length} / 6 个观点` : `${selectedConcepts.length} / 6 concepts selected`}
              </p>
            </>
          ) : (
            /* Trending / Custom mode: keypoint chips */
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
              <p className="text-xs text-zinc-600">
                {t(lang, UI.podcast.selected)} {selectedKps.length}{t(lang, UI.podcast.keypointsOf)}
              </p>
              <div className="flex gap-2">
                <Textarea value={customKp} onChange={e => setCustomKp(e.target.value)}
                  placeholder={t(lang, UI.podcast.addKpPlaceholder)}
                  className="bg-zinc-800 border-zinc-700 text-white resize-none" rows={2} />
                {customKp && (
                  <Button onClick={() => {
                    setKeypoints(prev => [...prev, customKp])
                    setSelectedKps(prev => [...prev, keypoints.length])
                    setCustomKp('')
                  }} variant="outline" className="shrink-0 border-zinc-700 text-zinc-400">
                    {t(lang, UI.podcast.addKpBtn)}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: 节目设置 ── */}
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
              <p className="text-xs text-zinc-600">
                {lang === 'zh' ? '建议时长：' : 'Suggested: '}{platforms.find(p => p.value === platform)?.durationHint}
              </p>
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
            <p className="text-xs text-zinc-600">
              {lang === 'zh' ? `约 ${Math.floor(duration / 15)} 个切片` : `~${Math.floor(duration / 15)} clips`}
            </p>
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

      {/* ── Step 3: 预览脚本 ── */}
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

      {/* ── Step 4: 分镜预览 ── */}
      {step === 4 && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3 text-zinc-500">
              <Loader2 size={24} className="animate-spin text-violet-400" />
              <span className="text-sm">{t(lang, UI.podcast.storyboardLoading)}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">
                  {lang === 'zh' ? `${storyboard.length} 个镜头` : `${storyboard.length} shots`}
                </p>
                <div className="flex items-center gap-3">
                  {Object.values(previewLoading).some(Boolean) ? (
                    <span className="text-xs text-violet-400 flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" />
                      {lang === 'zh' ? '生成预览图...' : 'Generating previews...'}
                    </span>
                  ) : (
                    <button
                      onClick={() => generateAllPreviews(storyboard)}
                      className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw size={12} />
                      {lang === 'zh' ? '生成全部预览图' : 'Generate All Previews'}
                    </button>
                  )}
                </div>
              </div>
              {previewError && (
                <p className="text-xs text-red-400">{previewError}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {storyboard.map((clip, i) => (
                  <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden group">
                    {/* Preview image area */}
                    <div className="relative aspect-[9/16] bg-zinc-800">
                      {previewLoading[clip.index] ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 size={20} className="animate-spin text-violet-400" />
                        </div>
                      ) : previewImages[clip.index] ? (
                        <img
                          src={previewImages[clip.index]!}
                          alt={`Shot ${clip.index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
                          <ImageIcon size={24} />
                          <span className="text-xs mt-1">{lang === 'zh' ? '待生成' : 'Pending'}</span>
                        </div>
                      )}
                      {/* Regenerate button overlay */}
                      <button
                        onClick={() => regeneratePreview(clip.index)}
                        disabled={previewLoading[clip.index]}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white/70
                                   hover:bg-black/70 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                        title={lang === 'zh' ? '重新生成预览图' : 'Regenerate preview'}
                      >
                        <RefreshCw size={14} className={previewLoading[clip.index] ? 'animate-spin' : ''} />
                      </button>
                      {/* Shot number badge */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/50 text-white text-xs">
                        #{clip.index + 1}
                      </div>
                      {/* Duration badge */}
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/50 text-white text-xs">
                        {clip.duration}s
                      </div>
                    </div>
                    {/* Info section */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-violet-400">{clip.speaker}</span>
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{clip.shot_type || '—'}</span>
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{clip.camera_movement || '—'}</span>
                      </div>
                      {/* Editable shot description */}
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">{lang === 'zh' ? '镜头描述' : 'Shot Desc'}</label>
                        <textarea
                          value={clip.shot_description ?? ''}
                          onChange={e => updateStoryboardShotDesc(i, e.target.value)}
                          placeholder={lang === 'zh' ? '描述画面内容、构图、光影...' : 'Describe the scene, composition, lighting...'}
                          rows={4}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-2
                                     text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-violet-500
                                     placeholder:text-zinc-600"
                        />
                      </div>
                      {/* Editable dialogue */}
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">{lang === 'zh' ? '台词' : 'Dialogue'}</label>
                        <textarea
                          value={clip.dialogue ?? ''}
                          onChange={e => updateStoryboardDialogue(i, e.target.value)}
                          placeholder={lang === 'zh' ? '角色台词...' : 'Character dialogue...'}
                          rows={2}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-2
                                     text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-violet-500
                                     placeholder:text-zinc-600"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 5: 确认生成 ── */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-zinc-800 space-y-3 text-sm">
            {(inputMode === 'url' || inputMode === 'pdf') && extractedTitle && (
              <div className="flex justify-between">
                <span className="text-zinc-400">{lang === 'zh' ? '来源' : 'Source'}</span>
                <span className="text-white truncate max-w-48">{extractedTitle}</span>
              </div>
            )}
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

      {/* ── Bottom nav ── */}
      <div className="flex justify-between mt-8 pt-6 border-t border-zinc-800">
        <Button variant="ghost" onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
          className="text-zinc-400 hover:text-white">
          <ChevronLeft size={16} className="mr-1" />{step === 0 ? t(lang, UI.common.back) : t(lang, UI.common.prev)}
        </Button>

        {step === 0 && (
          <Button
            onClick={() => {
              setStep(1)
              if (inputMode === 'url' || inputMode === 'pdf') extractConcepts()
              else generateKeypoints()
            }}
            disabled={step0Disabled}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {(inputMode === 'url' || inputMode === 'pdf')
              ? (lang === 'zh' ? '提取核心观点' : 'Extract Concepts')
              : (lang === 'zh' ? 'AI 提炼要点' : 'Extract Key Points')}
          </Button>
        )}
        {step === 1 && !loading && (
          <Button onClick={() => setStep(2)}
            disabled={(inputMode === 'url' || inputMode === 'pdf') ? selectedConcepts.length === 0 : selectedKps.length === 0}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {lang === 'zh' ? '下一步：节目设置' : 'Next: Setup'}
          </Button>
        )}
        {step === 2 && (
          <Button onClick={() => { savePrefs(); setStep(3); generateScript() }}
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
