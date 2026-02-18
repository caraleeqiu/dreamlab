'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpen, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Influencer, Language, ScriptClip } from '@/types'
import { PLATFORMS } from '@/lib/language'
import { UI, t } from '@/lib/i18n'

type Step = 'topic' | 'influencer' | 'platform' | 'script' | 'generate'

interface Props {
  lang: Language
  credits: number
  influencers: Influencer[]
}

export default function EduWizard({ lang, credits, influencers }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('topic')
  const [topic, setTopic] = useState('')
  const [depth, setDepth] = useState<'simple' | 'medium' | 'deep'>('medium')
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null)
  const [platform, setPlatform] = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [duration, setDuration] = useState(60)
  const [script, setScript] = useState<ScriptClip[] | null>(null)
  const [loadingScript, setLoadingScript] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const platforms = PLATFORMS[lang]
  const CREDIT_COST = 15

  const DURATIONS = [
    { id: 30,  label: `30${t(lang, UI.wizard.sec)}`,  clips: 3 },
    { id: 60,  label: `1${t(lang, UI.wizard.min)}`,   clips: 5 },
    { id: 90,  label: lang === 'zh' ? '1.5分钟' : '1.5min', clips: 8 },
    { id: 120, label: `2${t(lang, UI.wizard.min)}`,   clips: 10 },
  ]

  const DEPTHS = [
    { id: 'simple', label: t(lang, UI.wizard.depthSimple), desc: t(lang, UI.wizard.depthSimpleDesc) },
    { id: 'medium', label: t(lang, UI.wizard.depthMedium), desc: t(lang, UI.wizard.depthMediumDesc) },
    { id: 'deep',   label: t(lang, UI.wizard.depthDeep),   desc: t(lang, UI.wizard.depthDeepDesc) },
  ]

  const depthLabel: Record<string, string> = {
    simple: t(lang, UI.wizard.depthSimple),
    medium: t(lang, UI.wizard.depthMedium),
    deep:   t(lang, UI.wizard.depthDeep),
  }

  async function loadScript() {
    if (!selectedInfluencer || !topic || !platform) return
    setLoadingScript(true)
    setError('')
    try {
      const res = await fetch('/api/studio/podcast/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          format: 'solo',
          influencers: [selectedInfluencer],
          durationS: duration,
          lang,
          jobType: 'edu',
          depth,
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
    if (!selectedInfluencer || !topic || !platform || !script) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/studio/edu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
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

  const steps: Step[] = ['topic', 'influencer', 'platform', 'script', 'generate']
  const stepLabels = UI.wizard.eduSteps[lang]
  const stepIndex = steps.indexOf(step)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen size={18} className="text-violet-400" /> {t(lang, UI.wizard.eduTitle)}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">{t(lang, UI.wizard.eduSubtitle)} · {CREDIT_COST} {t(lang, UI.wizard.credits)}</p>
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
            {i < 4 && <div className={`flex-1 h-px ${i < stepIndex ? 'bg-violet-600' : 'bg-zinc-800'}`} />}
          </div>
        ))}
      </div>

      {/* Step: Topic */}
      {step === 'topic' && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{t(lang, UI.wizard.eduTopic)}</Label>
            <Input
              placeholder={lang === 'zh' ? '例如：量子计算、MBTI性格、黑洞原理' : 'e.g. Quantum Computing, Black holes, AI basics'}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-zinc-400">{t(lang, UI.wizard.eduDepth)}</Label>
            <div className="grid grid-cols-3 gap-2">
              {DEPTHS.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDepth(d.id as typeof depth)}
                  className={`p-3 rounded-lg border text-center transition-all ${depth === d.id ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
                >
                  <div className={`text-sm font-medium ${depth === d.id ? 'text-violet-300' : 'text-white'}`}>{d.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-zinc-400">{t(lang, UI.wizard.duration)}</Label>
            <div className="flex gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDuration(d.id)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${duration === d.id ? 'border-violet-500 bg-violet-600/10 text-violet-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={() => setStep('influencer')}
            disabled={!topic.trim()}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
          >
            {t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>
      )}

      {/* Step: Influencer */}
      {step === 'influencer' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">{t(lang, UI.wizard.eduPickInf)}</p>
          <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
            {influencers.map(inf => (
              <button
                key={inf.id}
                onClick={() => setSelectedInfluencer(inf)}
                className={`p-3 rounded-xl border text-left transition-all ${selectedInfluencer?.id === inf.id ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
              >
                {inf.frontal_image_url ? (
                  <img src={inf.frontal_image_url} alt={inf.name} className="w-full aspect-square object-cover rounded-lg mb-2" />
                ) : (
                  <div className="w-full aspect-square rounded-lg bg-zinc-700 mb-2 flex items-center justify-center text-2xl">
                    {inf.type === 'animal' ? '🐾' : inf.type === 'virtual' ? '🤖' : inf.type === 'brand' ? '✨' : '👤'}
                  </div>
                )}
                <div className={`text-sm font-medium ${selectedInfluencer?.id === inf.id ? 'text-violet-300' : 'text-white'}`}>{inf.name}</div>
                <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{inf.tagline}</div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {inf.domains.slice(0, 2).map(d => (
                    <span key={d} className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">{d}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('topic')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button
              onClick={() => setStep('platform')}
              disabled={!selectedInfluencer}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
            >
              {t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Platform */}
      {step === 'platform' && (
        <div className="space-y-5">
          <div className="space-y-3">
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
            <Button
              onClick={loadScript}
              disabled={!platform || loadingScript}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
            >
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
            {t(lang, UI.wizard.scriptPreview)}（{lang === 'zh' ? `共${script.length}段` : `${script.length} segments`}）
          </p>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
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
            <Button variant="outline" onClick={() => setStep('platform')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.regenerateBtn)}
            </Button>
            <Button
              onClick={() => setStep('generate')}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
            >
              {t(lang, UI.wizard.confirmScript)} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Generate */}
      {step === 'generate' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">{t(lang, UI.wizard.config)}</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-zinc-500">{t(lang, UI.wizard.eduTopic)}</span>
              <span className="text-zinc-300">{topic}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.eduDepth)}</span>
              <span className="text-zinc-300">{depthLabel[depth]}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.eduInf)}</span>
              <span className="text-zinc-300">{selectedInfluencer?.name}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.platform)}</span>
              <span className="text-zinc-300">{platforms.find(p => p.value === platform)?.label} · {aspectRatio}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.duration)}</span>
              <span className="text-zinc-300">{DURATIONS.find(d => d.id === duration)?.label}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-violet-900/20 border border-violet-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-violet-300">{t(lang, UI.wizard.cost)}</span>
              <span className="text-lg font-bold text-white">{CREDIT_COST}</span>
            </div>
            <div className="text-xs text-violet-500 mt-1">
              {t(lang, UI.wizard.balance)}：{credits} {t(lang, UI.wizard.credits)} → {t(lang, UI.wizard.remaining)} {credits - CREDIT_COST} {t(lang, UI.wizard.credits)}
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
            <Button
              onClick={handleSubmit}
              disabled={submitting || credits < CREDIT_COST}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
            >
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
