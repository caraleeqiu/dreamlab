'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Scissors, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Influencer, Language } from '@/types'
import { PLATFORMS } from '@/lib/language'
import { UI, t } from '@/lib/i18n'

type Step = 'source' | 'influencer' | 'platform' | 'confirm'

interface Props {
  lang: Language
  credits: number
  influencers: Influencer[]
}

export default function RemixWizard({ lang, credits, influencers }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('source')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoTitle, setVideoTitle] = useState('')
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null)
  const [platform, setPlatform] = useState('')
  const [remixStyle, setRemixStyle] = useState('commentary')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const platforms = PLATFORMS[lang]
  const CREDIT_COST = 5

  const REMIX_STYLES = [
    { id: 'commentary', label: UI.wizard.remixStyles.commentary[lang], desc: UI.wizard.remixStyles.commentary.desc[lang] },
    { id: 'reaction',   label: UI.wizard.remixStyles.reaction[lang],   desc: UI.wizard.remixStyles.reaction.desc[lang] },
    { id: 'duet',       label: UI.wizard.remixStyles.duet[lang],       desc: UI.wizard.remixStyles.duet.desc[lang] },
    { id: 'remake',     label: UI.wizard.remixStyles.remake[lang],     desc: UI.wizard.remixStyles.remake.desc[lang] },
  ]

  async function handleSubmit() {
    if (!selectedInfluencer || !videoUrl || !platform) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/studio/remix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          videoTitle: videoTitle || (lang === 'zh' ? '爆款二创' : 'Remix'),
          influencerId: selectedInfluencer.id,
          platform,
          remixStyle,
          aspectRatio,
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

  const stepLabels = UI.wizard.remixSteps[lang]
  const stepIndex = ['source', 'influencer', 'platform', 'confirm'].indexOf(step)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Scissors size={18} className="text-violet-400" /> {t(lang, UI.wizard.remixTitle)}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">{t(lang, UI.wizard.remixSubtitle)} · {CREDIT_COST} {t(lang, UI.wizard.credits)}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0
              ${i < stepIndex ? 'bg-violet-600 text-white' : i === stepIndex ? 'bg-violet-600/50 text-white ring-2 ring-violet-400/30' : 'bg-zinc-800 text-zinc-600'}`}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === stepIndex ? 'text-white' : 'text-zinc-600'}`}>{label}</span>
            {i < 3 && <div className={`flex-1 h-px ${i < stepIndex ? 'bg-violet-600' : 'bg-zinc-800'}`} />}
          </div>
        ))}
      </div>

      {/* Step: Source */}
      {step === 'source' && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{t(lang, UI.wizard.remixVideoLink)}</Label>
            <Input
              placeholder={lang === 'zh' ? '粘贴抖音/TikTok/YouTube/B站链接' : 'Paste Douyin/TikTok/YouTube/Bilibili link'}
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
            <p className="text-xs text-zinc-600">
              {lang === 'zh' ? '支持抖音、TikTok、YouTube、B站公开视频' : 'Supports Douyin, TikTok, YouTube, Bilibili public videos'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{t(lang, UI.wizard.remixTitle2)}</Label>
            <Input
              placeholder={t(lang, UI.wizard.remixTitlePH)}
              value={videoTitle}
              onChange={e => setVideoTitle(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-zinc-400">{t(lang, UI.wizard.remixStyle)}</Label>
            <div className="grid grid-cols-2 gap-2">
              {REMIX_STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setRemixStyle(s.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${remixStyle === s.id ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
                >
                  <div className={`text-sm font-medium ${remixStyle === s.id ? 'text-violet-300' : 'text-white'}`}>{s.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={() => setStep('influencer')}
            disabled={!videoUrl.trim()}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
          >
            {t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>
      )}

      {/* Step: Influencer */}
      {step === 'influencer' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">{t(lang, UI.wizard.remixPickInf)}</p>
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
                <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{inf.tagline}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('source')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
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
              onClick={() => setStep('confirm')}
              disabled={!platform}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
            >
              {t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">{t(lang, UI.wizard.config)}</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-zinc-500">{t(lang, UI.wizard.remixVideoLink)}</span>
              <span className="text-zinc-300 truncate">{videoUrl}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.remixStyle)}</span>
              <span className="text-zinc-300">{REMIX_STYLES.find(s => s.id === remixStyle)?.label}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.pickInfluencer)}</span>
              <span className="text-zinc-300">{selectedInfluencer?.name}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.platform)}</span>
              <span className="text-zinc-300">{platforms.find(p => p.value === platform)?.label} · {aspectRatio}</span>
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
            <Button variant="outline" onClick={() => setStep('platform')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
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
