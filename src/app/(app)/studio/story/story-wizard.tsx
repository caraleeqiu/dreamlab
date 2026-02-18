'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Film, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Influencer, Language, ScriptClip } from '@/types'
import { PLATFORMS } from '@/lib/language'
import { UI, t } from '@/lib/i18n'

type Step = 'story' | 'cast' | 'platform' | 'script' | 'generate'

interface Props {
  lang: Language
  credits: number
  influencers: Influencer[]
}

export default function StoryWizard({ lang, credits, influencers }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('story')
  const [storyTitle, setStoryTitle] = useState('')
  const [storyIdea, setStoryIdea] = useState('')
  const [genre, setGenre] = useState('romance')
  const [narrativeStyle, setNarrativeStyle] = useState('cinematic')
  const [castInfluencers, setCastInfluencers] = useState<Influencer[]>([])
  const [platform, setPlatform] = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [duration, setDuration] = useState(60)
  const [script, setScript] = useState<ScriptClip[] | null>(null)
  const [loadingScript, setLoadingScript] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const platforms = PLATFORMS[lang]
  const CREDIT_COST = 30

  const STORY_GENRES = [
    { id: 'romance',   label: lang === 'zh' ? '爱情' : 'Romance',   emoji: '💕' },
    { id: 'comedy',    label: lang === 'zh' ? '喜剧' : 'Comedy',    emoji: '😂' },
    { id: 'suspense',  label: lang === 'zh' ? '悬疑' : 'Suspense',  emoji: '🔍' },
    { id: 'fantasy',   label: lang === 'zh' ? '奇幻' : 'Fantasy',   emoji: '🌟' },
    { id: 'adventure', label: lang === 'zh' ? '冒险' : 'Adventure', emoji: '🗺️' },
    { id: 'horror',    label: lang === 'zh' ? '恐怖' : 'Horror',    emoji: '👻' },
  ]

  const NARRATIVE_STYLES = [
    { id: 'skit',      label: lang === 'zh' ? '小品式'   : 'Skit',      desc: lang === 'zh' ? '短小精悍的情景喜剧'   : 'Short punchy sketch comedy' },
    { id: 'cinematic', label: lang === 'zh' ? '电影感'   : 'Cinematic', desc: lang === 'zh' ? '大片级运镜与叙事节奏' : 'Blockbuster camera work & pacing' },
    { id: 'vlog',      label: lang === 'zh' ? 'Vlog式'   : 'Vlog',      desc: lang === 'zh' ? '第一人称沉浸记录'     : 'First-person immersive recording' },
    { id: 'manga',     label: lang === 'zh' ? '漫画分镜' : 'Manga',     desc: lang === 'zh' ? '参考漫画的夸张表达'   : 'Manga-style exaggerated expression' },
  ]

  function toggleCast(inf: Influencer) {
    setCastInfluencers(prev =>
      prev.find(i => i.id === inf.id)
        ? prev.filter(i => i.id !== inf.id)
        : prev.length < 3 ? [...prev, inf] : prev
    )
  }

  async function loadScript() {
    if (!castInfluencers.length || !storyIdea || !platform) return
    setLoadingScript(true)
    setError('')
    try {
      const res = await fetch('/api/studio/story/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyTitle, storyIdea, genre, narrativeStyle, influencers: castInfluencers, durationS: duration, lang }),
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
    if (!castInfluencers.length || !platform || !script) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/studio/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyTitle, storyIdea, genre, narrativeStyle, influencerIds: castInfluencers.map(i => i.id), platform, aspectRatio, durationS: duration, script, lang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t(lang, UI.common.error))
      router.push(`/jobs/${data.jobId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t(lang, UI.common.error))
      setSubmitting(false)
    }
  }

  const steps: Step[] = ['story', 'cast', 'platform', 'script', 'generate']
  const stepLabels = UI.wizard.storySteps[lang]
  const stepIndex = steps.indexOf(step)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Film size={18} className="text-violet-400" /> {t(lang, UI.wizard.storyTitle)}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">{t(lang, UI.wizard.storySubtitle)} · {CREDIT_COST} {t(lang, UI.wizard.credits)}</p>
        </div>
      </div>

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

      {step === 'story' && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{t(lang, UI.wizard.storyTitleOpt)}</Label>
            <Input
              placeholder={lang === 'zh' ? '例如：午夜的咖啡馆' : 'e.g. The Midnight Café'}
              value={storyTitle} onChange={e => setStoryTitle(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{t(lang, UI.wizard.storyIdea)}</Label>
            <textarea
              placeholder={lang === 'zh'
                ? '描述你的故事：主角是谁？发生了什么？想传递什么情感？\n例如：一个失恋女生在便利店遇到了一只会说话的猫...'
                : 'Describe your story: who is the protagonist? What happens? What emotion do you want to convey?'}
              value={storyIdea} onChange={e => setStoryIdea(e.target.value)}
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder:text-zinc-600 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-zinc-400">{lang === 'zh' ? '故事类型' : 'Genre'}</Label>
            <div className="grid grid-cols-3 gap-2">
              {STORY_GENRES.map(g => (
                <button key={g.id} onClick={() => setGenre(g.id)}
                  className={`p-2.5 rounded-lg border text-center transition-all ${genre === g.id ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}>
                  <div className="text-xl mb-0.5">{g.emoji}</div>
                  <div className={`text-xs font-medium ${genre === g.id ? 'text-violet-300' : 'text-white'}`}>{g.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-zinc-400">{lang === 'zh' ? '叙事风格' : 'Narrative Style'}</Label>
            <div className="grid grid-cols-2 gap-2">
              {NARRATIVE_STYLES.map(s => (
                <button key={s.id} onClick={() => setNarrativeStyle(s.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${narrativeStyle === s.id ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}>
                  <div className={`text-sm font-medium ${narrativeStyle === s.id ? 'text-violet-300' : 'text-white'}`}>{s.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-zinc-400">{t(lang, UI.wizard.duration)}</Label>
            <div className="flex gap-2">
              {[30, 60, 90, 120].map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${duration === d ? 'border-violet-500 bg-violet-600/10 text-violet-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}>
                  {d < 60 ? `${d}${t(lang, UI.wizard.sec)}` : `${d / 60}${t(lang, UI.wizard.min)}`}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={() => setStep('cast')} disabled={!storyIdea.trim()} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
            {t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>
      )}

      {step === 'cast' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">{t(lang, UI.wizard.storyCast)}</p>
          <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
            {influencers.map(inf => {
              const selected = castInfluencers.find(i => i.id === inf.id)
              const disabled = !selected && castInfluencers.length >= 3
              return (
                <button key={inf.id} onClick={() => !disabled && toggleCast(inf)} disabled={disabled}
                  className={`p-3 rounded-xl border text-left transition-all ${selected ? 'border-violet-500 bg-violet-600/10' : disabled ? 'border-zinc-800 opacity-40' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}>
                  {inf.frontal_image_url
                    ? <img src={inf.frontal_image_url} alt={inf.name} className="w-full aspect-square object-cover rounded-lg mb-2" />
                    : <div className="w-full aspect-square rounded-lg bg-zinc-700 mb-2 flex items-center justify-center text-2xl">
                        {inf.type === 'animal' ? '🐾' : inf.type === 'virtual' ? '🤖' : inf.type === 'brand' ? '✨' : '👤'}
                      </div>}
                  <div className="flex items-center gap-1.5">
                    {selected && <span className="text-xs text-violet-400">#{castInfluencers.indexOf(inf) + 1}</span>}
                    <span className={`text-sm font-medium ${selected ? 'text-violet-300' : 'text-white'}`}>{inf.name}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{inf.tagline}</div>
                </button>
              )
            })}
          </div>
          {castInfluencers.length > 0 && (
            <p className="text-xs text-zinc-500">{t(lang, UI.wizard.storySelected)}{castInfluencers.map(i => i.name).join('、')}</p>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('story')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">{t(lang, UI.wizard.prevBtn)}</Button>
            <Button onClick={() => setStep('platform')} disabled={castInfluencers.length === 0} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
              {t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === 'platform' && (
        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-zinc-400">{t(lang, UI.wizard.platform)}</Label>
            <div className="grid grid-cols-3 gap-2">
              {platforms.map(p => (
                <button key={p.value} onClick={() => { setPlatform(p.value); setAspectRatio(p.aspectRatio) }}
                  className={`p-3 rounded-lg border transition-all text-center ${platform === p.value ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}>
                  <div className="text-xl mb-1">{p.icon}</div>
                  <div className={`text-xs ${platform === p.value ? 'text-violet-300' : 'text-zinc-300'}`}>{p.label}</div>
                  <div className="text-xs text-zinc-600">{p.aspectRatio}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('cast')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">{t(lang, UI.wizard.prevBtn)}</Button>
            <Button onClick={loadScript} disabled={!platform || loadingScript} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
              {loadingScript
                ? <><Loader2 size={14} className="animate-spin mr-2" />{t(lang, UI.wizard.scriptLoading)}</>
                : <>{t(lang, UI.wizard.scriptPreview)} <ArrowRight size={14} className="ml-1" /></>}
            </Button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {step === 'script' && script && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            {t(lang, UI.wizard.scriptPreview)}（{STORY_GENRES.find(g => g.id === genre)?.label} · {NARRATIVE_STYLES.find(s => s.id === narrativeStyle)?.label} · {lang === 'zh' ? `${script.length}个场景` : `${script.length} scenes`}）
          </p>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {script.map((clip, i) => (
              <div key={i} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-violet-900/50 text-violet-400">{lang === 'zh' ? '场景' : 'Scene'} {i + 1}</span>
                  {clip.speaker && <span className="text-xs text-zinc-500">{lang === 'zh' ? '出演：' : 'Cast: '}{clip.speaker}</span>}
                  <span className="text-xs text-zinc-600 ml-auto">{clip.duration}s</span>
                </div>
                {clip.shot_description && <p className="text-xs text-zinc-500 mb-1 italic">{clip.shot_description}</p>}
                {clip.dialogue && <p className="text-sm text-zinc-200 leading-relaxed border-l-2 border-violet-600 pl-2">"{clip.dialogue}"</p>}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('platform')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">{t(lang, UI.wizard.regenerateBtn)}</Button>
            <Button onClick={() => setStep('generate')} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
              {t(lang, UI.wizard.confirmScript)} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === 'generate' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">{t(lang, UI.wizard.config)}</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-zinc-500">{lang === 'zh' ? '标题' : 'Title'}</span>
              <span className="text-zinc-300">{storyTitle || (lang === 'zh' ? '（无标题）' : '(Untitled)')}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '类型' : 'Genre'}</span>
              <span className="text-zinc-300">{STORY_GENRES.find(g => g.id === genre)?.emoji} {STORY_GENRES.find(g => g.id === genre)?.label}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '风格' : 'Style'}</span>
              <span className="text-zinc-300">{NARRATIVE_STYLES.find(s => s.id === narrativeStyle)?.label}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '演员' : 'Cast'}</span>
              <span className="text-zinc-300">{castInfluencers.map(i => i.name).join('、')}</span>
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
            <Button variant="outline" onClick={() => setStep('script')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">{t(lang, UI.wizard.prevBtn)}</Button>
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
