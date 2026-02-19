'use client'

import { useState, forwardRef, useImperativeHandle } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Film, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Influencer, Language, ScriptClip } from '@/types'
import { PLATFORMS } from '@/lib/language'
import { UI, t } from '@/lib/i18n'

type Step = 'story' | 'cast' | 'platform' | 'script' | 'generate'
type Category = 'suspense' | 'male' | 'female' | 'other'

interface Props {
  lang: Language
  credits: number
  influencers: Influencer[]
  initialPrefs?: Record<string, unknown>
}

export interface StoryWizardHandle {
  jumpToSeries: (name: string, episode: number) => void
}

const StoryWizard = forwardRef<StoryWizardHandle, Props>(function StoryWizard({ lang, credits, influencers, initialPrefs = {} }, ref) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('story')
  const [category, setCategory] = useState<Category>('suspense')
  const [storyTitle, setStoryTitle] = useState('')
  const [storyIdea, setStoryIdea] = useState('')
  const [genre, setGenre] = useState('suspense')
  const [narrativeStyle, setNarrativeStyle] = useState((initialPrefs.narrativeStyle as string) ?? 'cinematic')
  const [hookType, setHookType] = useState('midaction')
  const [subGenre, setSubGenre] = useState('highway')
  const [seriesMode, setSeriesMode] = useState(false)
  const [seriesName, setSeriesName] = useState('')
  const [episodeNumber, setEpisodeNumber] = useState(1)
  const [castInfluencers, setCastInfluencers] = useState<Influencer[]>([])
  const [platform, setPlatform] = useState((initialPrefs.platform as string) ?? '')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [duration, setDuration] = useState((initialPrefs.duration as number) ?? 60)
  const [script, setScript] = useState<ScriptClip[] | null>(null)
  const [castRoles, setCastRoles] = useState<Record<number, string>>({})
  const [cliffhanger, setCliffhanger] = useState('')
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set())
  const [loadingScript, setLoadingScript] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useImperativeHandle(ref, () => ({
    jumpToSeries(name: string, episode: number) {
      setSeriesMode(true)
      setSeriesName(name)
      setEpisodeNumber(episode)
      setStep('story')
    },
  }))

  const platforms = PLATFORMS[lang]
  const CREDIT_COST = 30

  function savePrefs() {
    fetch('/api/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'story', prefs: { platform, duration, narrativeStyle } }),
    }).catch(() => { /* silent */ })
  }

  const CATEGORIES: { id: Category; label: string; emoji: string; active: boolean }[] = [
    { id: 'suspense', label: lang === 'zh' ? '悬疑'  : 'Mystery', emoji: '🔍', active: true  },
    { id: 'male',     label: lang === 'zh' ? '男频'  : 'Male',    emoji: '⚔️', active: false },
    { id: 'female',   label: lang === 'zh' ? '女频'  : 'Female',  emoji: '💕', active: false },
    { id: 'other',    label: lang === 'zh' ? '其他'  : 'Other',   emoji: '✨', active: false },
  ]

  const STORY_GENRES = [
    { id: 'romance',   label: lang === 'zh' ? '爱情' : 'Romance',   emoji: '💕' },
    { id: 'comedy',    label: lang === 'zh' ? '喜剧' : 'Comedy',    emoji: '😂' },
    { id: 'suspense',  label: lang === 'zh' ? '悬疑' : 'Suspense',  emoji: '🔍' },
    { id: 'fantasy',   label: lang === 'zh' ? '奇幻' : 'Fantasy',   emoji: '🌟' },
    { id: 'adventure', label: lang === 'zh' ? '冒险' : 'Adventure', emoji: '🗺️' },
    { id: 'horror',    label: lang === 'zh' ? '恐怖' : 'Horror',    emoji: '👻' },
  ]

  const SUSPENSE_SUBTYPES = [
    { id: 'highway',       emoji: '🛣️', label: lang === 'zh' ? '公路灵异'   : 'Highway Paranormal', desc: lang === 'zh' ? '路肩行走者、幽灵搭车者、深夜公路异象' : 'Shoulder walkers, phantom hitchhikers, highway creatures' },
    { id: 'psychological', emoji: '🧠', label: lang === 'zh' ? '心理悬疑'   : 'Psychological',      desc: lang === 'zh' ? '信任崩塌、身份迷失、记忆欺骗'         : 'Betrayal, identity loss, memory distortion' },
    { id: 'truecrime',     emoji: '🚨', label: lang === 'zh' ? '真实犯罪'   : 'True Crime Style',   desc: lang === 'zh' ? '目击者视角、休息站发现、现场揭露'     : 'Witness POV, rest stop discoveries, crime scene reveals' },
    { id: 'dashcam',       emoji: '📹', label: lang === 'zh' ? '行车记录仪' : 'Dashcam Reveal',     desc: lang === 'zh' ? '录像揭示、背景细节、重播发现'         : 'Footage reveal, background detail, rewatch discovery' },
  ]

  const HOOK_TYPES = [
    {
      id: 'midaction',
      label: lang === 'zh' ? '开场即危机' : 'Mid-Action Open',
      desc:  lang === 'zh' ? '直接进入事件最高潮的一刻，无铺垫' : 'Drop into the peak moment, no setup',
    },
    {
      id: 'curiosity',
      label: lang === 'zh' ? '好奇缺口' : 'Curiosity Gap',
      desc:  lang === 'zh' ? '暗示一件事但不说破，让观众必须继续看' : 'Hint at something, never name it',
    },
    {
      id: 'confession',
      label: lang === 'zh' ? '第一人称忏悔' : 'Confession',
      desc:  lang === 'zh' ? '主角直视镜头说出一句"从未告诉过任何人的事"' : '"I never told anyone this… until now"',
    },
    {
      id: 'visual',
      label: lang === 'zh' ? '视觉悬疑物' : 'Visual Mystery',
      desc:  lang === 'zh' ? '一个不该出现的物体特写，先图后话' : 'Close-up of an object that shouldn\'t be there',
    },
    {
      id: 'silence',
      label: lang === 'zh' ? '静默冲击' : 'Dead Silence',
      desc:  lang === 'zh' ? '几乎无声开场，然后一个声音或一句话打破一切' : 'Near-silence, then one sound breaks everything',
    },
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
        body: JSON.stringify({ storyTitle, storyIdea, genre, narrativeStyle, hookType, subGenre, seriesMode, seriesName, episodeNumber, influencers: castInfluencers, durationS: duration, lang, castRoles }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t(lang, UI.common.error))
      setScript(data.script)
      if (data.cliffhanger) setCliffhanger(data.cliffhanger)
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
        body: JSON.stringify({ storyTitle, storyIdea, genre, narrativeStyle, hookType, subGenre, seriesMode, seriesName, episodeNumber, influencerIds: castInfluencers.map(i => i.id), platform, aspectRatio, durationS: duration, script, lang, castRoles, cliffhanger }),
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
          {/* 分类 Tab */}
          <div className="flex gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                disabled={!cat.active}
                onClick={() => { setCategory(cat.id); setGenre(cat.id === 'suspense' ? 'suspense' : genre) }}
                className={`relative flex-1 py-2 rounded-lg border text-sm font-medium transition-all
                  ${!cat.active ? 'border-zinc-800 text-zinc-600 cursor-not-allowed bg-zinc-900/50' :
                    category === cat.id ? 'border-violet-500 bg-violet-600/10 text-violet-300' :
                    'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'}`}
              >
                <span className="mr-1">{cat.emoji}</span>{cat.label}
                {!cat.active && (
                  <span className="absolute -top-1.5 -right-1 text-[9px] bg-zinc-700 text-zinc-400 px-1 rounded-full leading-4">
                    {lang === 'zh' ? '即将上线' : 'Soon'}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 悬疑子类型 */}
          {category === 'suspense' && (
            <div className="space-y-2">
              <Label className="text-zinc-400">{lang === 'zh' ? '悬疑类型' : 'Mystery Type'}</Label>
              <div className="grid grid-cols-2 gap-2">
                {SUSPENSE_SUBTYPES.map(s => (
                  <button key={s.id} onClick={() => setSubGenre(s.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${subGenre === s.id ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}>
                    <div className={`text-sm font-medium ${subGenre === s.id ? 'text-violet-300' : 'text-white'}`}>{s.emoji} {s.label}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 系列模式 */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-700 bg-zinc-800/50">
            <div>
              <div className="text-sm text-white">{lang === 'zh' ? '系列剧模式' : 'Series Mode'}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{lang === 'zh' ? '多集联动，每集结尾自动留悬念' : 'Multi-episode, auto cliffhanger between episodes'}</div>
            </div>
            <button onClick={() => setSeriesMode(v => !v)}
              className={`w-10 h-6 rounded-full transition-colors relative ${seriesMode ? 'bg-violet-600' : 'bg-zinc-700'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${seriesMode ? 'left-5' : 'left-1'}`} />
            </button>
          </div>
          {seriesMode && (
            <div className="space-y-3 p-3 rounded-lg border border-violet-800/50 bg-violet-900/10">
              <div className="space-y-1.5">
                <Label className="text-zinc-400">{lang === 'zh' ? '系列名称' : 'Series Name'}</Label>
                <Input placeholder={lang === 'zh' ? '例如：午夜高速' : 'e.g. Midnight Highway'}
                  value={seriesName} onChange={e => setSeriesName(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-400">{lang === 'zh' ? '第几集' : 'Episode'}</Label>
                <div className="flex gap-2">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => setEpisodeNumber(n)}
                      className={`w-8 h-8 rounded-lg border text-xs font-medium transition-all ${episodeNumber === n ? 'border-violet-500 bg-violet-600/10 text-violet-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

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
          {/* genre 由 category 决定，当前只开放悬疑，隐藏独立选择 */}
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
            <Label className="text-zinc-400">{lang === 'zh' ? '开场钩子' : 'Opening Hook'}</Label>
            <div className="space-y-2">
              {HOOK_TYPES.map(h => (
                <button key={h.id} onClick={() => setHookType(h.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${hookType === h.id ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}>
                  <div className={`text-sm font-medium ${hookType === h.id ? 'text-violet-300' : 'text-white'}`}>{h.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{h.desc}</div>
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
          {castInfluencers.length > 0 && (
            <div className="space-y-2 mt-3">
              <Label className="text-zinc-400">{lang === 'zh' ? '角色设定（可选）' : 'Character Roles (optional)'}</Label>
              {castInfluencers.map(inf => (
                <div key={inf.id} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 w-20 shrink-0">{inf.name}</span>
                  <Input
                    placeholder={lang === 'zh' ? '扮演：卡车司机、神秘乘客...' : 'Role: truck driver, mysterious stranger...'}
                    value={castRoles[inf.id] || ''}
                    onChange={e => setCastRoles(prev => ({ ...prev, [inf.id]: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 text-xs h-8"
                  />
                </div>
              ))}
            </div>
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
            <Button onClick={() => { savePrefs(); loadScript() }} disabled={!platform || loadingScript} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
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
                {clip.shot_description && (
                  <div className="mb-1">
                    <button
                      onClick={() => setExpandedScenes(prev => {
                        const next = new Set(prev)
                        next.has(i) ? next.delete(i) : next.add(i)
                        return next
                      })}
                      className="text-xs text-zinc-600 hover:text-zinc-400 italic transition-colors"
                    >
                      {expandedScenes.has(i) ? '▼' : '▶'} {lang === 'zh' ? '分镜描述' : 'Shot description'}
                    </button>
                    {expandedScenes.has(i) && (
                      <p className="text-xs text-zinc-500 mt-1 italic pl-3">{clip.shot_description}</p>
                    )}
                  </div>
                )}
                {clip.consistency_anchor !== undefined && (
                  <div className="mb-2">
                    <p className="text-xs text-amber-600/80 mb-0.5">{lang === 'zh' ? '视觉锁定' : 'Visual anchor'}</p>
                    <textarea
                      value={clip.consistency_anchor}
                      onChange={e => setScript(prev => prev ? prev.map((c, j) => j === i ? { ...c, consistency_anchor: e.target.value } : c) : prev)}
                      rows={2}
                      className="w-full text-xs text-amber-400/80 leading-relaxed border-l-2 border-amber-700 pl-2 bg-transparent resize-none focus:outline-none"
                    />
                  </div>
                )}
                {clip.dialogue !== undefined && (
                  <textarea
                    value={clip.dialogue}
                    onChange={e => setScript(prev => prev ? prev.map((c, j) => j === i ? { ...c, dialogue: e.target.value } : c) : prev)}
                    rows={2}
                    className="w-full text-sm text-zinc-200 leading-relaxed border-l-2 border-violet-600 pl-2 bg-transparent resize-none focus:outline-none"
                  />
                )}
                {/* 音效标注 */}
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {[
                    { id: '',          label: lang === 'zh' ? '无音效' : 'No SFX' },
                    { id: 'strings',   label: lang === 'zh' ? '弦乐张力' : 'Strings' },
                    { id: 'heartbeat', label: lang === 'zh' ? '心跳' : 'Heartbeat' },
                    { id: 'silence',   label: lang === 'zh' ? '完全静音' : 'Dead Silence' },
                    { id: 'ambient',   label: lang === 'zh' ? '环境音' : 'Ambient' },
                    { id: 'sting',     label: lang === 'zh' ? '音效刺' : 'Sting' },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => {
                      setScript(prev => prev ? prev.map((c, j) => j === i ? { ...c, bgm: opt.id } : c) : prev)
                    }} className={`text-xs px-2 py-0.5 rounded-full border transition-all ${(clip.bgm ?? '') === opt.id ? 'border-violet-500 bg-violet-600/20 text-violet-300' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
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
              <span className="text-zinc-500">{lang === 'zh' ? '类别' : 'Category'}</span>
              <span className="text-zinc-300">{CATEGORIES.find(c => c.id === category)?.emoji} {CATEGORIES.find(c => c.id === category)?.label}</span>
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
})

export default StoryWizard
