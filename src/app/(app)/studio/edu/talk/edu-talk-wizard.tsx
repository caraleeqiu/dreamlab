'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Mic, Loader2, CheckCircle2, Link as LinkIcon, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Influencer, Language, ScriptClip } from '@/types'
import { PLATFORMS } from '@/lib/language'
import { UI, t } from '@/lib/i18n'

type Step = 'input' | 'influencer' | 'platform' | 'script' | 'generate'
type InputMode = 'text' | 'url'
type Depth = 'beginner' | 'intermediate' | 'expert'

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

const CREDIT_COST = 15

const DEPTHS: { id: Depth; label: Record<Language, string>; desc: Record<Language, string> }[] = [
  { id: 'beginner',     label: { zh: '入门', en: 'Beginner' },     desc: { zh: '小白也能懂', en: 'Easy to understand' } },
  { id: 'intermediate', label: { zh: '进阶', en: 'Intermediate' }, desc: { zh: '有基础最佳', en: 'Some background helps' } },
  { id: 'expert',       label: { zh: '深度', en: 'Expert' },       desc: { zh: '专业级分析', en: 'Pro-level analysis' } },
]

const DURATIONS = [
  { id: 30,  label: { zh: '30秒', en: '30s' } },
  { id: 60,  label: { zh: '1分钟', en: '1min' } },
  { id: 90,  label: { zh: '1.5分钟', en: '1.5min' } },
  { id: 120, label: { zh: '2分钟', en: '2min' } },
]

export default function EduTalkWizard({ lang, credits, influencers }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [textInput, setTextInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [content, setContent] = useState<EduContent | null>(null)
  const [depth, setDepth] = useState<Depth>('intermediate')
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
  const steps: Step[] = ['input', 'influencer', 'platform', 'script', 'generate']
  const stepLabels = UI.wizard.eduTalkSteps[lang]
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
    if (!selectedInfluencer || !content || !platform) return
    setLoadingScript(true)
    setError('')
    try {
      const res = await fetch('/api/studio/edu/talk/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          influencerId: selectedInfluencer.id,
          depth,
          durationS: duration,
          platform,
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
      const res = await fetch('/api/studio/edu/talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          depth,
          influencerId: selectedInfluencer.id,
          platform,
          aspectRatio,
          durationS: duration,
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
            <Mic size={18} className="text-violet-400" />
            {t(lang, UI.wizard.eduTalkTitle)}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">{t(lang, UI.wizard.eduTalkSubtitle)} · {CREDIT_COST} {t(lang, UI.wizard.credits)}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1 mb-8">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0
              ${i < stepIndex ? 'bg-violet-600 text-white' : i === stepIndex ? 'bg-violet-600/50 text-white ring-2 ring-violet-400/30' : 'bg-zinc-800 text-zinc-600'}`}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === stepIndex ? 'text-white' : 'text-zinc-600'}`}>{label}</span>
            {i < stepLabels.length - 1 && <div className={`flex-1 h-px ${i < stepIndex ? 'bg-violet-600' : 'bg-zinc-800'}`} />}
          </div>
        ))}
      </div>

      {/* Step: Input */}
      {step === 'input' && (
        <div className="space-y-5">
          {/* Input mode toggle */}
          <div className="flex gap-2">
            {(['text', 'url'] as InputMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${inputMode === mode ? 'border-violet-500 bg-violet-600/10 text-violet-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}
              >
                {mode === 'text' ? <PenLine size={12} /> : <LinkIcon size={12} />}
                {t(lang, mode === 'text' ? UI.wizard.eduInputModeText : UI.wizard.eduInputModeUrl)}
              </button>
            ))}
          </div>

          {inputMode === 'text' ? (
            <div className="space-y-1.5">
              <Label className="text-zinc-400">{isZh ? '话题或概念' : 'Topic or concept'}</Label>
              <Textarea
                placeholder={t(lang, UI.wizard.eduTextPH)}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                rows={3}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-zinc-400">{isZh ? '文章链接 / arXiv 链接' : 'Article URL / arXiv link'}</Label>
              <Input
                placeholder={t(lang, UI.wizard.eduUrlPH)}
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
              />
              {/* Source hints */}
              <div className="rounded-xl border border-zinc-800 p-3 space-y-2 text-xs">
                {isZh ? (
                  <>
                    <div>
                      <p className="text-zinc-400 font-medium mb-1">✅ 支持的来源</p>
                      <ul className="space-y-0.5 text-zinc-500">
                        {['任意文章链接', '知乎', 'arXiv 论文', 'Wikipedia'].map(s => (
                          <li key={s} className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0" />{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="border-t border-zinc-800 pt-2">
                      <p className="text-zinc-400 font-medium mb-1">❌ 不支持的来源</p>
                      <ul className="space-y-0.5 text-zinc-600">
                        {['微信公众号（复制正文使用「文字输入」）', '小红书（需登录）', 'B站 / 抖音（复制文案）'].map(s => (
                          <li key={s} className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-zinc-700 shrink-0" />{s}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-zinc-400 font-medium mb-1">✅ Supported</p>
                      <ul className="space-y-0.5 text-zinc-500">
                        {['Any article URL', 'arXiv papers', 'Wikipedia', 'Medium / Substack'].map(s => (
                          <li key={s} className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0" />{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="border-t border-zinc-800 pt-2">
                      <p className="text-zinc-400 font-medium mb-1">❌ Not supported</p>
                      <ul className="space-y-0.5 text-zinc-600">
                        {['WeChat (copy text → use Text input)', 'Xiaohongshu (requires login)', 'YouTube / TikTok (copy description)'].map(s => (
                          <li key={s} className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-zinc-700 shrink-0" />{s}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Depth */}
          <div className="space-y-2">
            <Label className="text-zinc-400">{t(lang, UI.wizard.eduDepth)}</Label>
            <div className="grid grid-cols-3 gap-2">
              {DEPTHS.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDepth(d.id)}
                  className={`p-3 rounded-lg border text-center transition-all ${depth === d.id ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
                >
                  <div className={`text-sm font-medium ${depth === d.id ? 'text-violet-300' : 'text-white'}`}>{d.label[lang]}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{d.desc[lang]}</div>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            onClick={handleExtract}
            disabled={extracting || !(inputMode === 'text' ? textInput.trim() : urlInput.trim())}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
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
            <p className="text-xs text-zinc-400 leading-relaxed">{content.summary}</p>
            {content.keyPoints.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-xs text-zinc-600">{t(lang, UI.wizard.eduKeyPoints)}</p>
                {content.keyPoints.map((pt, i) => (
                  <div key={i} className="flex gap-2 text-xs text-zinc-400">
                    <span className="text-violet-500 shrink-0">·</span>
                    <span>{pt}</span>
                  </div>
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
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${duration === d.id ? 'border-violet-500 bg-violet-600/10 text-violet-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}
                >
                  {d.label[lang]}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-zinc-400">{t(lang, UI.wizard.eduPickInf)}</p>
          <div className="grid grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
            {influencers.map(inf => (
              <button
                key={inf.id}
                onClick={() => setSelectedInfluencer(inf)}
                className={`p-3 rounded-xl border text-left transition-all ${selectedInfluencer?.id === inf.id ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
              >
                {inf.frontal_image_url
                  ? <img src={inf.frontal_image_url} alt={inf.name} className="w-full aspect-square object-cover rounded-lg mb-2" />
                  : <div className="w-full aspect-square rounded-lg bg-zinc-700 mb-2 flex items-center justify-center text-2xl">🎙️</div>
                }
                <div className={`text-sm font-medium ${selectedInfluencer?.id === inf.id ? 'text-violet-300' : 'text-white'}`}>{inf.name}</div>
                <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{inf.tagline}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('input')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button onClick={() => setStep('platform')} disabled={!selectedInfluencer} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
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
                  className={`p-3 rounded-lg border transition-all text-center ${platform === p.value ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
                >
                  <div className="text-xl mb-1">{p.icon}</div>
                  <div className={`text-xs ${platform === p.value ? 'text-violet-300' : 'text-zinc-300'}`}>{p.label}</div>
                  <div className="text-xs text-zinc-600">{p.aspectRatio}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('influencer')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button onClick={loadScript} disabled={!platform || loadingScript} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
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
            {t(lang, UI.wizard.scriptPreview)} ({isZh ? `共${script.length}段` : `${script.length} clips`})
          </p>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {script.map((clip, i) => (
              <div key={i} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-violet-900/50 text-violet-400">{t(lang, UI.wizard.segment)} {i + 1}</span>
                  <span className="text-xs text-zinc-500">{clip.duration}s</span>
                </div>
                <p className="text-sm text-zinc-200 leading-relaxed">{clip.dialogue}</p>
                {clip.shot_description && (
                  <p className="text-xs text-zinc-600 mt-1 italic">{clip.shot_description}</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep('platform'); loadScript() }} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800" disabled={loadingScript}>
              {loadingScript ? <Loader2 size={14} className="animate-spin" /> : t(lang, UI.wizard.regenerateBtn)}
            </Button>
            <Button onClick={() => setStep('generate')} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
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
              <span className="text-zinc-500">{t(lang, UI.wizard.eduDepth)}</span>
              <span className="text-zinc-300">{DEPTHS.find(d => d.id === depth)?.label[lang]}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.eduInf)}</span>
              <span className="text-zinc-300">{selectedInfluencer.name}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.platform)}</span>
              <span className="text-zinc-300">{platforms.find(p => p.value === platform)?.label} · {aspectRatio}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.duration)}</span>
              <span className="text-zinc-300">{DURATIONS.find(d => d.id === duration)?.label[lang]}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-violet-900/20 border border-violet-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-violet-300">{t(lang, UI.wizard.cost)}</span>
              <span className="text-lg font-bold text-white">{CREDIT_COST}</span>
            </div>
            <div className="text-xs text-violet-500 mt-1">
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
            <Button onClick={handleSubmit} disabled={submitting || credits < CREDIT_COST} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
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
