'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Sparkles, Loader2, CheckCircle2, Link as LinkIcon, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Influencer, Language, ScriptClip } from '@/types'
import { PLATFORMS } from '@/lib/language'
import { UI, t } from '@/lib/i18n'

type Step = 'input' | 'influencer' | 'style' | 'script' | 'generate'
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
  influencers: Influencer[]
}

const CREDIT_COST = 30

const ANIME_STYLES = [
  { id: 'fantasy',   emoji: '🌟', label: { zh: '奇幻魔法', en: 'Fantasy' },   desc: { zh: '魔法世界·史诗特效', en: 'Magic world · Epic effects' } },
  { id: 'cyberpunk', emoji: '🤖', label: { zh: '赛博朋克', en: 'Cyberpunk' }, desc: { zh: '霓虹未来·科技感', en: 'Neon future · High-tech' } },
  { id: 'cute',      emoji: '🌸', label: { zh: '可爱萌系', en: 'Cute' },      desc: { zh: '卡哇伊·马卡龙色', en: 'Kawaii · Pastel colors' } },
  { id: 'ancient',   emoji: '🏯', label: { zh: '古风水墨', en: 'Ancient' },   desc: { zh: '水墨国风·古典美', en: 'Ink wash · Classical' } },
  { id: 'modern',    emoji: '🏙️', label: { zh: '现代都市', en: 'Modern' },    desc: { zh: '时尚都市·生活感', en: 'Urban · Lifestyle' } },
  { id: 'minimal',   emoji: '⬜', label: { zh: '极简留白', en: 'Minimal' },   desc: { zh: '纯净背景·高级感', en: 'Pure background · Premium' } },
]

const DURATIONS = [
  { id: 30,  label: { zh: '30秒', en: '30s' } },
  { id: 60,  label: { zh: '1分钟', en: '1min' } },
  { id: 90,  label: { zh: '1.5分钟', en: '1.5min' } },
  { id: 120, label: { zh: '2分钟', en: '2min' } },
]

export default function EduAnimatedWizard({ lang, credits, influencers }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [textInput, setTextInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [content, setContent] = useState<EduContent | null>(null)
  const [animeStyle, setAnimeStyle] = useState('fantasy')
  const [duration, setDuration] = useState(60)
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null)
  const [platform, setPlatform] = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [script, setScript] = useState<ScriptClip[] | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [loadingScript, setLoadingScript] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isZh = lang === 'zh'
  const platforms = PLATFORMS[lang]
  const steps: Step[] = ['input', 'influencer', 'style', 'script', 'generate']
  const stepLabels = UI.wizard.eduAnimatedSteps[lang]
  const stepIndex = steps.indexOf(step)

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
      setStep('influencer')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t(lang, UI.common.error))
    } finally {
      setExtracting(false)
    }
  }

  async function loadScript() {
    if (!selectedInfluencer || !content) return
    setLoadingScript(true)
    setError('')
    try {
      const res = await fetch('/api/studio/edu/animated/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          influencerId: selectedInfluencer.id,
          animeStyle,
          durationS: duration,
          lang,
        }),
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
    if (!selectedInfluencer || !content || !platform || !script) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/studio/edu/animated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          influencerId: selectedInfluencer.id,
          animeStyle,
          platform,
          aspectRatio,
          script,
          lang,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t(lang, UI.common.error))
      router.push(`/jobs/${data.jobId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t(lang, UI.common.error))
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles size={18} className="text-amber-400" />
            {t(lang, UI.wizard.eduAnimatedTitle)}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">{t(lang, UI.wizard.eduAnimatedSubtitle)} · {CREDIT_COST} {t(lang, UI.wizard.credits)}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1 mb-8">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0
              ${i < stepIndex ? 'bg-amber-600 text-white' : i === stepIndex ? 'bg-amber-600/50 text-white ring-2 ring-amber-400/30' : 'bg-zinc-800 text-zinc-600'}`}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === stepIndex ? 'text-white' : 'text-zinc-600'}`}>{label}</span>
            {i < stepLabels.length - 1 && <div className={`flex-1 h-px ${i < stepIndex ? 'bg-amber-600' : 'bg-zinc-800'}`} />}
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${inputMode === mode ? 'border-amber-500 bg-amber-600/10 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}
              >
                {mode === 'text' ? <PenLine size={12} /> : <LinkIcon size={12} />}
                {t(lang, mode === 'text' ? UI.wizard.eduInputModeText : UI.wizard.eduInputModeUrl)}
              </button>
            ))}
          </div>

          {inputMode === 'text' ? (
            <div className="space-y-1.5">
              <Label className="text-zinc-400">{isZh ? '科学话题或概念' : 'Science topic or concept'}</Label>
              <Textarea
                placeholder={t(lang, UI.wizard.eduTextPH)}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                rows={3}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-zinc-400">{isZh ? '文章或论文链接' : 'Article or paper URL'}</Label>
              <Input
                placeholder={t(lang, UI.wizard.eduUrlPH)}
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            onClick={handleExtract}
            disabled={extracting || !(inputMode === 'text' ? textInput.trim() : urlInput.trim())}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            {extracting
              ? <><Loader2 size={14} className="animate-spin mr-2" />{t(lang, UI.wizard.eduExtracting)}</>
              : <>{t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" /></>}
          </Button>
        </div>
      )}

      {/* Step: Influencer */}
      {step === 'influencer' && content && (
        <div className="space-y-5">
          {/* Content preview */}
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-2">
            <h3 className="text-sm font-medium text-white">{content.title}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{content.summary}</p>
            {content.keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {content.keyPoints.map((pt, i) => (
                  <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">{pt}</span>
                ))}
              </div>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-zinc-400">{t(lang, UI.wizard.duration)}</Label>
            <div className="flex gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDuration(d.id)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${duration === d.id ? 'border-amber-500 bg-amber-600/10 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}
                >
                  {d.label[lang]}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-zinc-400">{t(lang, UI.wizard.eduAnimatedPickInf)}</p>
          <div className="grid grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
            {influencers.map(inf => (
              <button
                key={inf.id}
                onClick={() => setSelectedInfluencer(inf)}
                className={`p-3 rounded-xl border text-left transition-all ${selectedInfluencer?.id === inf.id ? 'border-amber-500 bg-amber-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
              >
                {inf.frontal_image_url
                  ? <img src={inf.frontal_image_url} alt={inf.name} className="w-full aspect-square object-cover rounded-lg mb-2" />
                  : <div className="w-full aspect-square rounded-lg bg-zinc-700 mb-2 flex items-center justify-center text-2xl">✨</div>
                }
                <div className={`text-sm font-medium ${selectedInfluencer?.id === inf.id ? 'text-amber-300' : 'text-white'}`}>{inf.name}</div>
                <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{inf.tagline}</div>
                <div className="text-xs mt-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    inf.type === 'virtual' ? 'bg-violet-900/50 text-violet-400' :
                    inf.type === 'animal' ? 'bg-emerald-900/50 text-emerald-400' :
                    inf.type === 'brand' ? 'bg-amber-900/50 text-amber-400' :
                    'bg-zinc-800 text-zinc-500'
                  }`}>{inf.type}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('input')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button onClick={() => setStep('style')} disabled={!selectedInfluencer} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
              {t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Style + Platform */}
      {step === 'style' && (
        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-zinc-400">{isZh ? '动画风格' : 'Animation Style'}</Label>
            <div className="grid grid-cols-2 gap-2">
              {ANIME_STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setAnimeStyle(s.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${animeStyle === s.id ? 'border-amber-500 bg-amber-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span>{s.emoji}</span>
                    <span className={`text-sm font-medium ${animeStyle === s.id ? 'text-amber-300' : 'text-white'}`}>{s.label[lang]}</span>
                  </div>
                  <div className="text-xs text-zinc-500">{s.desc[lang]}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-400">{t(lang, UI.wizard.platform)}</Label>
            <div className="grid grid-cols-3 gap-2">
              {platforms.map(p => (
                <button
                  key={p.value}
                  onClick={() => { setPlatform(p.value); setAspectRatio(p.aspectRatio) }}
                  className={`p-3 rounded-lg border transition-all text-center ${platform === p.value ? 'border-amber-500 bg-amber-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
                >
                  <div className="text-xl mb-1">{p.icon}</div>
                  <div className={`text-xs ${platform === p.value ? 'text-amber-300' : 'text-zinc-300'}`}>{p.label}</div>
                  <div className="text-xs text-zinc-600">{p.aspectRatio}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('influencer')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button onClick={loadScript} disabled={!platform || loadingScript} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
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
          <p className="text-sm text-zinc-400">
            {t(lang, UI.wizard.scriptPreview)} ({isZh ? `共${script.length}场景` : `${script.length} scenes`})
          </p>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {script.map((clip, i) => (
              <div key={i} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400">{isZh ? '场景' : 'Scene'} {i + 1}</span>
                  <span className="text-xs text-zinc-500">{clip.duration}s</span>
                </div>
                {clip.dialogue && <p className="text-sm text-zinc-200 leading-relaxed mb-1">{clip.dialogue}</p>}
                {clip.shot_description && (
                  <p className="text-xs text-zinc-600 italic">{clip.shot_description}</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep('style'); loadScript() }} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800" disabled={loadingScript}>
              {loadingScript ? <Loader2 size={14} className="animate-spin" /> : t(lang, UI.wizard.regenerateBtn)}
            </Button>
            <Button onClick={() => setStep('generate')} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
              {t(lang, UI.wizard.confirmScript)} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Generate */}
      {step === 'generate' && content && selectedInfluencer && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">{t(lang, UI.wizard.config)}</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-zinc-500">{isZh ? '话题' : 'Topic'}</span>
              <span className="text-zinc-300 text-xs line-clamp-1">{content.title}</span>
              <span className="text-zinc-500">{isZh ? '动画风格' : 'Style'}</span>
              <span className="text-zinc-300">{ANIME_STYLES.find(s => s.id === animeStyle)?.emoji} {ANIME_STYLES.find(s => s.id === animeStyle)?.label[lang]}</span>
              <span className="text-zinc-500">{isZh ? '主角' : 'Character'}</span>
              <span className="text-zinc-300">{selectedInfluencer.name}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.platform)}</span>
              <span className="text-zinc-300">{platforms.find(p => p.value === platform)?.label} · {aspectRatio}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.duration)}</span>
              <span className="text-zinc-300">{DURATIONS.find(d => d.id === duration)?.label[lang]}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-900/20 border border-amber-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-amber-300">{t(lang, UI.wizard.cost)}</span>
              <span className="text-lg font-bold text-white">{CREDIT_COST}</span>
            </div>
            <div className="text-xs text-amber-600 mt-1">
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
            <Button onClick={handleSubmit} disabled={submitting || credits < CREDIT_COST} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
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
