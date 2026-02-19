'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Link as LinkIcon, PenLine, Film } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Language, ScriptClip } from '@/types'
import { PLATFORMS } from '@/lib/language'
import { UI, t } from '@/lib/i18n'

type Step = 'input' | 'style' | 'platform' | 'script' | 'generate'
type InputMode = 'text' | 'url'

interface EduContent {
  title: string
  summary: string
  keyPoints: string[]
  difficulty: string
  suggestedDuration: number
  sourceType: string
}

interface Props {
  lang: Language
  credits: number
}

const CREDIT_COST = 20

const STEPS: Step[] = ['input', 'style', 'platform', 'script', 'generate']
const STEP_LABELS: Record<Language, string[]> = {
  zh: ['输入', '风格', '平台', '脚本', '生成'],
  en: ['Input', 'Style', 'Platform', 'Script', 'Generate'],
}

const VISUAL_STYLES = [
  {
    id: 'cinematic',
    emoji: '🎬',
    label: { zh: '电影写实', en: 'Cinematic' },
    desc: { zh: '影视级真实感，戏剧光影，景深效果', en: 'Film-grade realism, dramatic lighting, depth of field' },
  },
  {
    id: 'anime',
    emoji: '✨',
    label: { zh: '动漫风格', en: 'Anime' },
    desc: { zh: '高品质动漫，鲜艳色彩，动态构图', en: 'Premium anime, vibrant colors, dynamic compositions' },
  },
  {
    id: 'watercolor',
    emoji: '🎨',
    label: { zh: '水彩插画', en: 'Watercolor' },
    desc: { zh: '水彩质感，柔和色调，艺术印象派', en: 'Soft washes, organic textures, impressionistic' },
  },
  {
    id: 'abstract',
    emoji: '🔷',
    label: { zh: '抽象动态', en: 'Abstract' },
    desc: { zh: '几何抽象，流动粒子，现代设计感', en: 'Geometric shapes, flowing motion, modern design' },
  },
  {
    id: 'scifi',
    emoji: '🚀',
    label: { zh: '科幻未来', en: 'Sci-Fi' },
    desc: { zh: '全息界面，霓虹效果，星际视觉', en: 'Holographic UI, neon accents, space vistas' },
  },
  {
    id: 'nature',
    emoji: '🌿',
    label: { zh: '自然纪录', en: 'Nature Doc' },
    desc: { zh: '纪录片质感，微距镜头，黄金时刻光线', en: 'Documentary style, macro, golden hour' },
  },
]

const DURATIONS = [
  { id: 30,  label: { zh: '30秒', en: '30s' } },
  { id: 60,  label: { zh: '1分钟', en: '1min' } },
  { id: 90,  label: { zh: '1.5分钟', en: '1.5min' } },
  { id: 120, label: { zh: '2分钟', en: '2min' } },
]

export default function EduCinematicWizard({ lang, credits }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [textInput, setTextInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [content, setContent] = useState<EduContent | null>(null)
  const [visualStyle, setVisualStyle] = useState('cinematic')
  const [duration, setDuration] = useState(60)
  const [platform, setPlatform] = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [script, setScript] = useState<ScriptClip[] | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [loadingScript, setLoadingScript] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isZh = lang === 'zh'
  const platforms = PLATFORMS[lang]
  const stepLabels = STEP_LABELS[lang]
  const stepIndex = STEPS.indexOf(step)

  async function handleExtract() {
    const raw = inputMode === 'url' ? urlInput.trim() : textInput.trim()
    if (!raw) return
    setExtracting(true)
    setError('')
    try {
      const res = await fetch('/api/studio/edu/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: raw, lang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t(lang, UI.common.error))
      setContent(data)
      setDuration(data.suggestedDuration || 60)
      setStep('style')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t(lang, UI.common.error))
    } finally {
      setExtracting(false)
    }
  }

  async function loadScript() {
    if (!content || !platform) return
    setLoadingScript(true)
    setError('')
    try {
      const res = await fetch('/api/studio/edu/cinematic/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, visualStyle, durationS: duration, platform, lang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t(lang, UI.common.error))
      setScript(data.script)
      setStep('script')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t(lang, UI.common.error))
    } finally {
      setLoadingScript(false)
    }
  }

  async function handleSubmit() {
    if (!content || !platform || !script) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/studio/edu/cinematic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, visualStyle, platform, aspectRatio, script, lang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t(lang, UI.common.error))
      router.push(`/jobs/${data.jobId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t(lang, UI.common.error))
      setSubmitting(false)
    }
  }

  const selectedStyle = VISUAL_STYLES.find(s => s.id === visualStyle)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Film size={18} className="text-emerald-400" />
            {isZh ? '全动画科普' : 'Cinematic Science'}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isZh ? '无出镜角色 · 纯视觉场景动画 · Kling 文生视频' : 'No presenter · Pure cinematic scenes · AI-generated visuals'} · {CREDIT_COST} {t(lang, UI.wizard.credits)}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1 mb-8">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0
              ${i < stepIndex ? 'bg-emerald-600 text-white' : i === stepIndex ? 'bg-emerald-600/50 text-white ring-2 ring-emerald-400/30' : 'bg-zinc-800 text-zinc-600'}`}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === stepIndex ? 'text-white' : 'text-zinc-600'}`}>{label}</span>
            {i < stepLabels.length - 1 && <div className={`flex-1 h-px ${i < stepIndex ? 'bg-emerald-600' : 'bg-zinc-800'}`} />}
          </div>
        ))}
      </div>

      {/* Step: Input */}
      {step === 'input' && (
        <div className="space-y-5">
          <div className="flex gap-2">
            {(['text', 'url'] as InputMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${inputMode === mode ? 'border-emerald-500 bg-emerald-600/10 text-emerald-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}
              >
                {mode === 'text' ? <PenLine size={12} /> : <LinkIcon size={12} />}
                {mode === 'text' ? (isZh ? '输入话题' : 'Type topic') : (isZh ? '链接 / arXiv' : 'URL / arXiv')}
              </button>
            ))}
          </div>

          {inputMode === 'text' ? (
            <Textarea
              placeholder={isZh ? '输入科学话题、现象或概念，例如：量子纠缠、黑洞形成、蝴蝶变态…' : 'Enter a science topic, e.g. quantum entanglement, black hole formation, butterfly metamorphosis…'}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              rows={3}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
            />
          ) : (
            <Input
              placeholder={isZh ? 'https://arxiv.org/abs/...' : 'https://arxiv.org/abs/...'}
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 font-mono text-sm"
            />
          )}

          <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-xs text-zinc-500 space-y-1">
            <p className="font-medium text-zinc-400">{isZh ? '全动画模式' : 'Cinematic mode'}</p>
            <p>· {isZh ? '无真人/虚拟角色出镜' : 'No on-screen presenter'}</p>
            <p>· {isZh ? 'AI 生成纯视觉场景（Kling 文生视频）' : 'AI-generated pure visual scenes (Kling text2video)'}</p>
            <p>· {isZh ? 'Seedance API 开放后自动切换更高质量引擎' : 'Auto-upgrades to Seedance when API launches'}</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            onClick={handleExtract}
            disabled={extracting || !(inputMode === 'text' ? textInput.trim() : urlInput.trim())}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {extracting
              ? <><Loader2 size={14} className="animate-spin mr-2" />{isZh ? '解析中…' : 'Extracting…'}</>
              : <>{isZh ? '解析内容' : 'Extract content'} <ArrowRight size={14} className="ml-1" /></>}
          </Button>
        </div>
      )}

      {/* Step: Style */}
      {step === 'style' && content && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-2">
            <h3 className="text-sm font-semibold text-white">{content.title}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{content.summary}</p>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-zinc-400">{t(lang, UI.wizard.duration)}</Label>
            <div className="flex gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDuration(d.id)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${duration === d.id ? 'border-emerald-500 bg-emerald-600/10 text-emerald-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}
                >
                  {d.label[lang]}
                </button>
              ))}
            </div>
          </div>

          {/* Visual style */}
          <div className="space-y-2">
            <Label className="text-zinc-400">{isZh ? '视觉风格' : 'Visual style'}</Label>
            <div className="grid grid-cols-2 gap-2">
              {VISUAL_STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setVisualStyle(s.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${visualStyle === s.id ? 'border-emerald-500 bg-emerald-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{s.emoji}</span>
                    <span className={`text-sm font-medium ${visualStyle === s.id ? 'text-emerald-300' : 'text-white'}`}>{s.label[lang]}</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-snug">{s.desc[lang]}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('input')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button onClick={() => setStep('platform')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              {t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Platform */}
      {step === 'platform' && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-zinc-400">{t(lang, UI.wizard.platform)}</Label>
            <div className="grid grid-cols-3 gap-2">
              {platforms.map(p => (
                <button
                  key={p.value}
                  onClick={() => { setPlatform(p.value); setAspectRatio(p.aspectRatio) }}
                  className={`p-3 rounded-lg border transition-all text-center ${platform === p.value ? 'border-emerald-500 bg-emerald-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
                >
                  <div className="text-xl mb-1">{p.icon}</div>
                  <div className={`text-xs ${platform === p.value ? 'text-emerald-300' : 'text-zinc-300'}`}>{p.label}</div>
                  <div className="text-xs text-zinc-600">{p.aspectRatio}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('style')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button onClick={loadScript} disabled={!platform || loadingScript} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              {loadingScript
                ? <><Loader2 size={14} className="animate-spin mr-2" />{t(lang, UI.wizard.scriptLoading)}</>
                : <>{t(lang, UI.wizard.scriptPreview)} <ArrowRight size={14} className="ml-1" /></>}
            </Button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {/* Step: Script preview */}
      {step === 'script' && script && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              {isZh ? `场景脚本（${script.length} 个镜头，无出镜角色）` : `Scene script (${script.length} shots, no presenter)`}
            </p>
            {selectedStyle && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400">
                {selectedStyle.emoji} {selectedStyle.label[lang]}
              </span>
            )}
          </div>
          <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
            {script.map((clip, i) => (
              <div key={i} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400">
                    {t(lang, UI.wizard.segment)} {i + 1}
                  </span>
                  <span className="text-xs text-zinc-500">{clip.duration}s</span>
                  {clip.shot_type && <span className="text-xs text-zinc-600">{clip.shot_type}</span>}
                  {clip.camera_movement && <span className="text-xs text-zinc-600">{clip.camera_movement}</span>}
                </div>
                {clip.voiceover && (
                  <p className="text-sm text-zinc-200 leading-relaxed mb-1.5">
                    <span className="text-zinc-600 text-xs">{isZh ? '旁白' : 'VO'}: </span>
                    {clip.voiceover}
                  </p>
                )}
                <p className="text-xs text-zinc-500 italic leading-relaxed">{clip.shot_description}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep('platform'); loadScript() }} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800" disabled={loadingScript}>
              {loadingScript ? <Loader2 size={14} className="animate-spin" /> : t(lang, UI.wizard.regenerateBtn)}
            </Button>
            <Button onClick={() => setStep('generate')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              {t(lang, UI.wizard.confirmScript)} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Generate */}
      {step === 'generate' && content && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">{t(lang, UI.wizard.config)}</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-zinc-500">{isZh ? '话题' : 'Topic'}</span>
              <span className="text-zinc-300 text-xs line-clamp-1">{content.title}</span>
              <span className="text-zinc-500">{isZh ? '视觉风格' : 'Style'}</span>
              <span className="text-zinc-300">{selectedStyle?.emoji} {selectedStyle?.label[lang]}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.platform)}</span>
              <span className="text-zinc-300">{platforms.find(p => p.value === platform)?.label} · {aspectRatio}</span>
              <span className="text-zinc-500">{isZh ? '场景数' : 'Scenes'}</span>
              <span className="text-zinc-300">{script?.length}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-xs text-zinc-500 space-y-1">
            <p className="font-medium text-zinc-400">{isZh ? '生成模式' : 'Generation mode'}</p>
            <p>· {isZh ? '每个场景独立提交 Kling 文生视频' : 'Each scene submitted to Kling text2video independently'}</p>
            <p>· {isZh ? '无角色参考图，纯 prompt 生成' : 'No reference image — pure prompt-to-video'}</p>
            <p>· {isZh ? 'Seedance API 上线后自动升级引擎' : 'Auto-upgrades to Seedance when available'}</p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-900/20 border border-emerald-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-300">{t(lang, UI.wizard.cost)}</span>
              <span className="text-lg font-bold text-white">{CREDIT_COST}</span>
            </div>
            <div className="text-xs text-emerald-500 mt-1">
              {t(lang, UI.wizard.balance)}：{credits} → {t(lang, UI.wizard.remaining)} {credits - CREDIT_COST} {t(lang, UI.wizard.credits)}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {credits < CREDIT_COST && (
            <p className="text-sm text-amber-400">
              {t(lang, UI.wizard.insufficient)}<a href="/credits" className="underline ml-1">{t(lang, UI.wizard.topUp)}</a>
            </p>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('script')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || credits < CREDIT_COST} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting
                ? <><Loader2 size={14} className="animate-spin mr-2" />{t(lang, UI.wizard.generating)}</>
                : <><CheckCircle2 size={14} className="mr-2" />{t(lang, UI.wizard.confirmBtn)} (-{CREDIT_COST} {t(lang, UI.wizard.credits)})</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
