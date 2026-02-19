'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Scissors, Loader2, CheckCircle2,
  Video, Wand2, Film, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Influencer, Language, RemixAnalysis, Job } from '@/types'
import { PLATFORMS } from '@/lib/language'
import { UI, t } from '@/lib/i18n'
import { CREDIT_COSTS } from '@/lib/config'

// ─── Tab definitions ─────────────────────────────────────────────────────────

type RemixMode = 'visual' | 'splice' | 'imitate'

const TAB_META = {
  visual: {
    icon: <Video size={14} className="text-violet-400" />,
    color: 'violet' as const,
    labelZh: '换主体',
    labelEn: 'Visual Remix',
    descZh: '替换视频主体为你的网红形象',
    descEn: 'Replace the video subject with your influencer',
  },
  splice: {
    icon: <Scissors size={14} className="text-pink-400" />,
    color: 'pink' as const,
    labelZh: '片段替换',
    labelEn: 'Segment Splice',
    descZh: '替换已有视频中的某段时间区间，AI生成或直接上传素材',
    descEn: 'Replace a time segment in an existing video — AI-generate or upload a clip',
  },
  imitate: {
    icon: <Wand2 size={14} className="text-cyan-400" />,
    color: 'cyan' as const,
    labelZh: '脚本仿写',
    labelEn: 'Script Imitation',
    descZh: '分析参考视频的叙事结构和风格，用你的网红重新创作同款内容',
    descEn: 'Analyze a reference video\'s narrative structure and recreate it with your influencer',
  },
} satisfies Record<RemixMode, {
  icon: React.ReactNode
  color: 'violet' | 'pink' | 'cyan'
  labelZh: string
  labelEn: string
  descZh: string
  descEn: string
}>

// ─── Influencer picker (shared) ───────────────────────────────────────────────

function InfluencerPicker({
  influencers,
  selected,
  onSelect,
}: {
  influencers: Influencer[]
  selected: Influencer | null
  onSelect: (inf: Influencer) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
      {influencers.map(inf => (
        <button
          key={inf.id}
          onClick={() => onSelect(inf)}
          className={`p-3 rounded-xl border text-left transition-all ${
            selected?.id === inf.id
              ? 'border-violet-500 bg-violet-600/10'
              : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
          }`}
        >
          {inf.frontal_image_url ? (
            <img src={inf.frontal_image_url} alt={inf.name} className="w-full aspect-square object-cover rounded-lg mb-2" />
          ) : (
            <div className="w-full aspect-square rounded-lg bg-zinc-700 mb-2 flex items-center justify-center text-2xl">
              {inf.type === 'animal' ? '🐾' : inf.type === 'virtual' ? '🤖' : inf.type === 'brand' ? '✨' : '👤'}
            </div>
          )}
          <div className={`text-sm font-medium ${selected?.id === inf.id ? 'text-violet-300' : 'text-white'}`}>{inf.name}</div>
          <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{inf.tagline}</div>
        </button>
      ))}
    </div>
  )
}

// ─── Platform picker (shared) ─────────────────────────────────────────────────

function PlatformPicker({
  lang,
  platform,
  onSelect,
}: {
  lang: Language
  platform: string
  onSelect: (value: string, aspectRatio: string) => void
}) {
  const platforms = PLATFORMS[lang]
  return (
    <div className="grid grid-cols-3 gap-2">
      {platforms.map(p => (
        <button
          key={p.value}
          onClick={() => onSelect(p.value, p.aspectRatio)}
          className={`p-3 rounded-lg border transition-all text-center ${
            platform === p.value
              ? 'border-violet-500 bg-violet-600/10'
              : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
          }`}
        >
          <div className="text-xl mb-1">{p.icon}</div>
          <div className={`text-xs ${platform === p.value ? 'text-violet-300' : 'text-zinc-300'}`}>{p.label}</div>
          <div className="text-xs text-zinc-600">{p.aspectRatio}</div>
        </button>
      ))}
    </div>
  )
}

// ─── Mode 1: Visual Remix ─────────────────────────────────────────────────────

type VisualStep = 'source' | 'influencer' | 'platform' | 'confirm'

function VisualRemix({
  lang, credits, influencers,
}: {
  lang: Language
  credits: number
  influencers: Influencer[]
}) {
  const router = useRouter()
  const [step, setStep] = useState<VisualStep>('source')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoTitle, setVideoTitle] = useState('')
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null)
  const [platform, setPlatform] = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [remixStyle, setRemixStyle] = useState('commentary')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const CREDIT_COST = CREDIT_COSTS.remix
  const platforms = PLATFORMS[lang]

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

  const steps = lang === 'zh'
    ? ['选视频', '选网红', '平台设置', '确认生成']
    : ['Video', 'Influencer', 'Platform', 'Confirm']
  const stepIndex = ['source', 'influencer', 'platform', 'confirm'].indexOf(step)

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
              i < stepIndex ? 'bg-violet-600 text-white' : i === stepIndex ? 'bg-violet-600/50 text-white ring-2 ring-violet-400/30' : 'bg-zinc-800 text-zinc-600'
            }`}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === stepIndex ? 'text-white' : 'text-zinc-600'}`}>{label}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-px ${i < stepIndex ? 'bg-violet-600' : 'bg-zinc-800'}`} />}
          </div>
        ))}
      </div>

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
                  className={`p-3 rounded-lg border text-left transition-all ${
                    remixStyle === s.id ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }`}
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

      {step === 'influencer' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">{t(lang, UI.wizard.remixPickInf)}</p>
          <InfluencerPicker influencers={influencers} selected={selectedInfluencer} onSelect={setSelectedInfluencer} />
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

      {step === 'platform' && (
        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-zinc-400">{t(lang, UI.wizard.platform)}</Label>
            <PlatformPicker lang={lang} platform={platform} onSelect={(v, ar) => { setPlatform(v); setAspectRatio(ar) }} />
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

      {step === 'confirm' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">{t(lang, UI.wizard.config)}</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-zinc-500">{lang === 'zh' ? '视频链接' : 'Video URL'}</span>
              <span className="text-zinc-300 truncate">{videoUrl}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '二创方式' : 'Style'}</span>
              <span className="text-zinc-300">{REMIX_STYLES.find(s => s.id === remixStyle)?.label}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '网红' : 'Influencer'}</span>
              <span className="text-zinc-300">{selectedInfluencer?.name}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '平台' : 'Platform'}</span>
              <span className="text-zinc-300">{platforms.find(p => p.value === platform)?.label} · {aspectRatio}</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-violet-900/20 border border-violet-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-violet-300">{t(lang, UI.wizard.cost)}</span>
              <span className="text-lg font-bold text-white">{CREDIT_COST}</span>
            </div>
            <div className="text-xs text-violet-500 mt-1">
              {lang === 'zh' ? '余额' : 'Balance'}：{credits} → {credits - CREDIT_COST} {t(lang, UI.wizard.credits)}
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {credits < CREDIT_COST && (
            <p className="text-sm text-amber-400">{t(lang, UI.wizard.insufficient)}<a href="/credits" className="underline ml-1">{t(lang, UI.wizard.topUp)}</a></p>
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

// ─── Mode 2: Segment Splice ───────────────────────────────────────────────────

function SegmentSplice({
  lang,
  jobs,
}: {
  lang: Language
  jobs: Job[]
}) {
  const router = useRouter()
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [startS, setStartS] = useState('')
  const [endS, setEndS] = useState('')
  const [replacementType, setReplacementType] = useState<'ai-generate' | 'upload-clip'>('ai-generate')
  const [prompt, setPrompt] = useState('')
  const [clipUrl, setClipUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const validJobs = jobs.filter(j => j.final_video_url)

  async function handleSubmit() {
    if (!selectedJobId || !startS || !endS) return
    const start = parseFloat(startS)
    const end = parseFloat(endS)
    if (isNaN(start) || isNaN(end) || end <= start) {
      setError(lang === 'zh' ? '时间范围无效，结束时间必须大于开始时间' : 'Invalid time range: end must be greater than start')
      return
    }
    if (replacementType === 'ai-generate' && !prompt.trim()) {
      setError(lang === 'zh' ? '请输入生成提示词' : 'Please enter a prompt')
      return
    }
    if (replacementType === 'upload-clip' && !clipUrl.trim()) {
      setError(lang === 'zh' ? '请输入素材链接' : 'Please enter a clip URL')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/studio/remix/splice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJobId,
          startS: start,
          endS: end,
          replacementType,
          prompt: prompt || undefined,
          clipUrl: clipUrl || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || (lang === 'zh' ? '提交失败' : 'Submit failed'))
      if (data.splicedUrl) {
        router.push(`/jobs/${selectedJobId}`)
      } else {
        router.push(`/jobs/${data.jobId}`)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (lang === 'zh' ? '提交失败' : 'Submit failed'))
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Job picker */}
      <div className="space-y-2">
        <Label className="text-zinc-400">{lang === 'zh' ? '选择要修改的视频' : 'Select a video to edit'}</Label>
        {validJobs.length === 0 ? (
          <p className="text-sm text-zinc-500 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
            {lang === 'zh' ? '暂无可用的已完成视频' : 'No completed videos available yet'}
          </p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {validJobs.map(j => (
              <button
                key={j.id}
                onClick={() => setSelectedJobId(j.id)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  selectedJobId === j.id ? 'border-pink-500 bg-pink-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                }`}
              >
                <div className={`text-sm font-medium ${selectedJobId === j.id ? 'text-pink-300' : 'text-white'}`}>
                  #{j.id} {j.title || (lang === 'zh' ? '无标题' : 'Untitled')}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {j.type} · {j.aspect_ratio} · {new Date(j.created_at).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Time range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-zinc-400">{lang === 'zh' ? '开始时间（秒）' : 'Start (seconds)'}</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            placeholder="0.0"
            value={startS}
            onChange={e => setStartS(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-400">{lang === 'zh' ? '结束时间（秒）' : 'End (seconds)'}</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            placeholder="5.0"
            value={endS}
            onChange={e => setEndS(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
        </div>
      </div>

      {/* Replacement type */}
      <div className="space-y-3">
        <Label className="text-zinc-400">{lang === 'zh' ? '替换方式' : 'Replacement method'}</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setReplacementType('ai-generate')}
            className={`p-3 rounded-lg border text-left transition-all ${
              replacementType === 'ai-generate' ? 'border-pink-500 bg-pink-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
            }`}
          >
            <div className={`text-sm font-medium ${replacementType === 'ai-generate' ? 'text-pink-300' : 'text-white'}`}>
              {lang === 'zh' ? 'AI 生成' : 'AI Generate'}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">{lang === 'zh' ? '描述场景，可灵生成替换片段' : 'Describe a scene, Kling generates it'}</div>
          </button>
          <button
            onClick={() => setReplacementType('upload-clip')}
            className={`p-3 rounded-lg border text-left transition-all ${
              replacementType === 'upload-clip' ? 'border-pink-500 bg-pink-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
            }`}
          >
            <div className={`text-sm font-medium ${replacementType === 'upload-clip' ? 'text-pink-300' : 'text-white'}`}>
              {lang === 'zh' ? '上传素材' : 'Upload Clip'}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">{lang === 'zh' ? '提供视频链接直接拼接' : 'Provide a clip URL to splice in'}</div>
          </button>
        </div>
      </div>

      {replacementType === 'ai-generate' && (
        <div className="space-y-1.5">
          <Label className="text-zinc-400">{lang === 'zh' ? '描述要生成的场景' : 'Describe the scene to generate'}</Label>
          <Textarea
            placeholder={lang === 'zh' ? '例：网红站在落地窗前，阳光洒在肩上，微微转头看向镜头...' : 'e.g. The influencer stands by a floor-to-ceiling window, sunlight on their shoulders, turns to camera...'}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
          />
        </div>
      )}

      {replacementType === 'upload-clip' && (
        <div className="space-y-1.5">
          <Label className="text-zinc-400">{lang === 'zh' ? '替换素材链接' : 'Clip URL'}</Label>
          <Input
            placeholder={lang === 'zh' ? '粘贴视频直链（MP4）' : 'Paste direct MP4 URL'}
            value={clipUrl}
            onChange={e => setClipUrl(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={submitting || !selectedJobId || !startS || !endS}
        className="w-full bg-pink-600 hover:bg-pink-700 text-white"
      >
        {submitting
          ? <><Loader2 size={14} className="animate-spin mr-2" />{lang === 'zh' ? '处理中...' : 'Processing...'}</>
          : <><Scissors size={14} className="mr-2" />{lang === 'zh' ? '开始替换' : 'Splice Now'}</>}
      </Button>
    </div>
  )
}

// ─── Mode 3: Script Imitation ─────────────────────────────────────────────────

type ImitateStep = 'source' | 'analyze' | 'review' | 'influencer' | 'platform' | 'confirm'

function ScriptImitation({
  lang,
  credits,
  influencers,
}: {
  lang: Language
  credits: number
  influencers: Influencer[]
}) {
  const router = useRouter()
  const [step, setStep] = useState<ImitateStep>('source')
  const [videoUrl, setVideoUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<RemixAnalysis | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [showScenes, setShowScenes] = useState(false)
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null)
  const [platform, setPlatform] = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const CREDIT_COST = CREDIT_COSTS.remix

  async function handleAnalyze() {
    if (!videoUrl.trim()) return
    setAnalyzing(true)
    setAnalysisError('')
    try {
      const res = await fetch('/api/studio/remix/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, lang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || (lang === 'zh' ? '分析失败' : 'Analysis failed'))
      setAnalysis(data)
      setStep('review')
    } catch (e: unknown) {
      setAnalysisError(e instanceof Error ? e.message : (lang === 'zh' ? '分析失败' : 'Analysis failed'))
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSubmit() {
    if (!analysis || !selectedInfluencer || !platform) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/studio/remix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          influencerId: selectedInfluencer.id,
          platform,
          aspectRatio,
          referenceVideoUrl: videoUrl,
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

  const steps = lang === 'zh'
    ? ['输入链接', '分析中', '审阅分析', '选网红', '平台', '确认生成']
    : ['Enter URL', 'Analyze', 'Review', 'Influencer', 'Platform', 'Confirm']
  const stepKeys: ImitateStep[] = ['source', 'analyze', 'review', 'influencer', 'platform', 'confirm']
  const stepIndex = stepKeys.indexOf(step)

  const platforms = PLATFORMS[lang]

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-1.5 shrink-0">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
              i < stepIndex ? 'bg-cyan-600 text-white' : i === stepIndex ? 'bg-cyan-600/50 text-white ring-2 ring-cyan-400/30' : 'bg-zinc-800 text-zinc-600'
            }`}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === stepIndex ? 'text-white' : 'text-zinc-600'}`}>{label}</span>
            {i < steps.length - 1 && <div className={`w-4 h-px shrink-0 ${i < stepIndex ? 'bg-cyan-600' : 'bg-zinc-800'}`} />}
          </div>
        ))}
      </div>

      {/* Step: source */}
      {step === 'source' && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-zinc-400">
              {lang === 'zh' ? '参考视频链接' : 'Reference video URL'}
            </Label>
            <Input
              placeholder={lang === 'zh' ? '粘贴抖音/TikTok/YouTube/B站链接' : 'Paste Douyin/TikTok/YouTube/Bilibili link'}
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
            <p className="text-xs text-zinc-600">
              {lang === 'zh'
                ? 'AI 将分析视频的叙事结构、节奏、场景风格，生成可复用的脚本框架'
                : 'AI will analyze narrative structure, pacing, and visual style to generate a reusable script framework'}
            </p>
          </div>

          {analysisError && <p className="text-sm text-red-400">{analysisError}</p>}

          <Button
            onClick={() => { setStep('analyze'); handleAnalyze() }}
            disabled={!videoUrl.trim() || analyzing}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {analyzing
              ? <><Loader2 size={14} className="animate-spin mr-2" />{lang === 'zh' ? 'AI 分析中...' : 'Analyzing...'}</>
              : <><Wand2 size={14} className="mr-2" />{lang === 'zh' ? '开始分析' : 'Analyze Video'}</>}
          </Button>
        </div>
      )}

      {/* Step: analyze (loading) */}
      {step === 'analyze' && (
        <div className="py-12 flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-cyan-400" />
          <p className="text-zinc-300 font-medium">{lang === 'zh' ? 'AI 正在分析视频...' : 'AI is analyzing the video...'}</p>
          <p className="text-xs text-zinc-500 text-center max-w-xs">
            {lang === 'zh'
              ? '提取关键帧 → Gemini Vision 解析叙事结构和镜头语言 → 生成仿写脚本框架'
              : 'Extracting keyframes → Gemini Vision parses narrative & shot language → generating imitation script'}
          </p>
          {analysisError && (
            <div className="mt-4 space-y-3 text-center">
              <p className="text-sm text-red-400">{analysisError}</p>
              <Button onClick={() => setStep('source')} variant="outline" className="border-zinc-700 text-zinc-300">
                {lang === 'zh' ? '重试' : 'Retry'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step: review */}
      {step === 'review' && analysis && (
        <div className="space-y-5">
          {/* Narrative overview */}
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-3">
            <h3 className="text-sm font-medium text-cyan-300 flex items-center gap-2">
              <Film size={14} /> {lang === 'zh' ? '叙事分析' : 'Narrative Analysis'}
            </h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-zinc-500">{lang === 'zh' ? '开头钩子' : 'Hook type'}</span>
              <span className="text-zinc-300">{analysis.narrative.hookType}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '结构' : 'Structure'}</span>
              <span className="text-zinc-300">{analysis.narrative.structure}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '节奏' : 'Pacing'}</span>
              <span className="text-zinc-300">{analysis.narrative.pacing}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '平台风格' : 'Platform style'}</span>
              <span className="text-zinc-300">{analysis.narrative.platformStyle}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '预计时长' : 'Est. duration'}</span>
              <span className="text-zinc-300">{analysis.narrative.estimatedTotalDuration}s · {analysis.narrative.totalScenes} {lang === 'zh' ? '幕' : 'scenes'}</span>
            </div>
          </div>

          {/* Style guide */}
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-2">
            <h3 className="text-sm font-medium text-cyan-300">{lang === 'zh' ? '视觉风格指南' : 'Visual Style Guide'}</h3>
            <div className="text-xs text-zinc-400 space-y-1">
              <div><span className="text-zinc-500">{lang === 'zh' ? '画风：' : 'Visual: '}</span>{analysis.styleGuide.visualStyle}</div>
              <div><span className="text-zinc-500">{lang === 'zh' ? '色调：' : 'Color: '}</span>{analysis.styleGuide.colorPalette}</div>
              <div><span className="text-zinc-500">{lang === 'zh' ? '剪辑节奏：' : 'Editing: '}</span>{analysis.styleGuide.editingRhythm}</div>
            </div>
          </div>

          {/* Script preview (collapsible) */}
          <div className="rounded-xl border border-zinc-700 overflow-hidden">
            <button
              onClick={() => setShowScenes(!showScenes)}
              className="w-full p-3 flex items-center justify-between bg-zinc-800/50 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <span>{lang === 'zh' ? `仿写脚本预览（${analysis.remixScript.length} 幕）` : `Script preview (${analysis.remixScript.length} scenes)`}</span>
              {showScenes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showScenes && (
              <div className="divide-y divide-zinc-700/50 max-h-[300px] overflow-y-auto">
                {analysis.remixScript.map((clip, i) => (
                  <div key={i} className="p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-cyan-400">#{i + 1}</span>
                      <span className="text-xs text-zinc-500">{clip.duration}s · {clip.camera_movement || ''} · {clip.bgm || ''}</span>
                    </div>
                    {clip.dialogue && (
                      <p className="text-xs text-white">「{clip.dialogue}」</p>
                    )}
                    <p className="text-xs text-zinc-500 line-clamp-2">{clip.shot_description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep('source'); setAnalysis(null) }} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              <RefreshCw size={14} className="mr-1" />{lang === 'zh' ? '重新分析' : 'Re-analyze'}
            </Button>
            <Button
              onClick={() => setStep('influencer')}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {lang === 'zh' ? '使用此脚本' : 'Use this script'} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: influencer */}
      {step === 'influencer' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            {lang === 'zh' ? '选择用哪位网红来演绎这个脚本' : 'Choose which influencer will perform this script'}
          </p>
          <InfluencerPicker influencers={influencers} selected={selectedInfluencer} onSelect={setSelectedInfluencer} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('review')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button
              onClick={() => setStep('platform')}
              disabled={!selectedInfluencer}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: platform */}
      {step === 'platform' && (
        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-zinc-400">{t(lang, UI.wizard.platform)}</Label>
            <PlatformPicker lang={lang} platform={platform} onSelect={(v, ar) => { setPlatform(v); setAspectRatio(ar) }} />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('influencer')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button
              onClick={() => setStep('confirm')}
              disabled={!platform}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: confirm */}
      {step === 'confirm' && analysis && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">{t(lang, UI.wizard.config)}</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-zinc-500">{lang === 'zh' ? '脚本幕数' : 'Script scenes'}</span>
              <span className="text-zinc-300">{analysis.remixScript.length}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '钩子类型' : 'Hook type'}</span>
              <span className="text-zinc-300">{analysis.narrative.hookType}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '网红' : 'Influencer'}</span>
              <span className="text-zinc-300">{selectedInfluencer?.name}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '平台' : 'Platform'}</span>
              <span className="text-zinc-300">{platforms.find(p => p.value === platform)?.label} · {aspectRatio}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-cyan-900/20 border border-cyan-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-cyan-300">{t(lang, UI.wizard.cost)}</span>
              <span className="text-lg font-bold text-white">{CREDIT_COST}</span>
            </div>
            <div className="text-xs text-cyan-500 mt-1">
              {lang === 'zh' ? '余额' : 'Balance'}：{credits} → {credits - CREDIT_COST} {t(lang, UI.wizard.credits)}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {credits < CREDIT_COST && (
            <p className="text-sm text-amber-400">{t(lang, UI.wizard.insufficient)}<a href="/credits" className="underline ml-1">{t(lang, UI.wizard.topUp)}</a></p>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('platform')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || credits < CREDIT_COST}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {submitting
                ? <><Loader2 size={14} className="animate-spin mr-2" />{t(lang, UI.wizard.generating)}</>
                : <><Wand2 size={14} className="mr-2" />{lang === 'zh' ? '开始仿写生成' : 'Generate Imitation'} (-{CREDIT_COST})</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Root component (tabs) ────────────────────────────────────────────────────

interface Props {
  lang: Language
  credits: number
  influencers: Influencer[]
  jobs: Job[]
}

export default function RemixWizard({ lang, credits, influencers, jobs }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<RemixMode>('visual')

  const TABS: { id: RemixMode; icon: React.ReactNode; labelZh: string; labelEn: string; activeClass: string }[] = [
    {
      id: 'visual',
      icon: <Video size={14} />,
      labelZh: '换主体',
      labelEn: 'Visual Remix',
      activeClass: 'bg-violet-600/20 text-violet-300 border-violet-500/50',
    },
    {
      id: 'splice',
      icon: <Scissors size={14} />,
      labelZh: '片段替换',
      labelEn: 'Segment Splice',
      activeClass: 'bg-pink-600/20 text-pink-300 border-pink-500/50',
    },
    {
      id: 'imitate',
      icon: <Wand2 size={14} />,
      labelZh: '脚本仿写',
      labelEn: 'Script Imitation',
      activeClass: 'bg-cyan-600/20 text-cyan-300 border-cyan-500/50',
    },
  ]

  const activeTabMeta = TAB_META[activeTab]

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
          <p className="text-xs text-zinc-500 mt-0.5">
            {lang === 'zh' ? activeTabMeta.descZh : activeTabMeta.descEn}
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5 mb-6 p-1 bg-zinc-900/60 rounded-xl border border-zinc-800">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-medium transition-all border ${
                isActive ? tab.activeClass : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{lang === 'zh' ? tab.labelZh : tab.labelEn}</span>
              <span className="sm:hidden">{lang === 'zh' ? tab.labelZh : tab.labelEn}</span>
            </button>
          )
        })}
      </div>

      {/* Credit badge for current tab */}
      {activeTab !== 'splice' && (
        <div className="flex items-center gap-2 mb-4 text-xs text-zinc-500">
          <span>{lang === 'zh' ? '费用' : 'Cost'}:</span>
          <span className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
            {CREDIT_COSTS.remix} {t(lang, UI.wizard.credits)}
          </span>
          <span>{lang === 'zh' ? '余额' : 'Balance'}:</span>
          <span className={`px-2 py-0.5 rounded-full border ${credits >= CREDIT_COSTS.remix ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-amber-900/20 border-amber-700 text-amber-400'}`}>
            {credits}
          </span>
        </div>
      )}
      {activeTab === 'splice' && (
        <div className="flex items-center gap-2 mb-4 text-xs text-zinc-500">
          <span className="px-2 py-0.5 rounded-full bg-green-900/20 border border-green-700 text-green-400">
            {lang === 'zh' ? '免费编辑' : 'Free edit'}
          </span>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'visual' && (
        <VisualRemix lang={lang} credits={credits} influencers={influencers} />
      )}
      {activeTab === 'splice' && (
        <SegmentSplice lang={lang} jobs={jobs} />
      )}
      {activeTab === 'imitate' && (
        <ScriptImitation lang={lang} credits={credits} influencers={influencers} />
      )}
    </div>
  )
}
