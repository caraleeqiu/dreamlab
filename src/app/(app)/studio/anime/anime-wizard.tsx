'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Sparkles, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Influencer, Language, ScriptClip } from '@/types'
import { PLATFORMS } from '@/lib/language'

type Step = 'brand' | 'influencer' | 'style' | 'script' | 'generate'

interface Props {
  lang: Language
  credits: number
  influencers: Influencer[]
}

const ANIME_STYLES = [
  { id: 'cyberpunk', label: '赛博朋克', desc: '霓虹都市·科技感', emoji: '🌆' },
  { id: 'ancient', label: '古风', desc: '水墨·东方美学', emoji: '🏮' },
  { id: 'modern', label: '现代都市', desc: '时尚·生活感', emoji: '🏙️' },
  { id: 'cute', label: '二次元', desc: '萌系·Q版', emoji: '🌸' },
  { id: 'fantasy', label: '奇幻', desc: '魔法世界·史诗感', emoji: '✨' },
  { id: 'minimal', label: '极简', desc: '纯净·高端感', emoji: '⬜' },
]

export default function AnimeWizard({ lang, credits, influencers }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('brand')
  const [brandName, setBrandName] = useState('')
  const [productName, setProductName] = useState('')
  const [productDesc, setProductDesc] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null)
  const [platform, setPlatform] = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [animeStyle, setAnimeStyle] = useState('cyberpunk')
  const [script, setScript] = useState<ScriptClip[] | null>(null)
  const [loadingScript, setLoadingScript] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const platforms = PLATFORMS[lang]
  const CREDIT_COST = 50

  // Suggest virtual/brand influencers first
  const sortedInfluencers = [
    ...influencers.filter(i => i.type === 'virtual' || i.type === 'brand'),
    ...influencers.filter(i => i.type !== 'virtual' && i.type !== 'brand'),
  ]

  async function loadScript() {
    if (!selectedInfluencer || !brandName || !productName || !platform) return
    setLoadingScript(true)
    setError('')
    try {
      const res = await fetch('/api/studio/anime/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName,
          productName,
          productDesc,
          targetAudience,
          animeStyle,
          influencer: selectedInfluencer,
          lang,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '脚本生成失败')
      setScript(data.script)
      setStep('script')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '脚本生成失败')
    } finally {
      setLoadingScript(false)
    }
  }

  async function handleSubmit() {
    if (!selectedInfluencer || !brandName || !productName || !platform || !script) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/studio/anime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName,
          productName,
          productDesc,
          targetAudience,
          animeStyle,
          influencerId: selectedInfluencer.id,
          platform,
          aspectRatio,
          script,
          lang,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '提交失败')
      router.push(`/jobs/${data.jobId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '提交失败')
      setSubmitting(false)
    }
  }

  const steps: Step[] = ['brand', 'influencer', 'style', 'script', 'generate']
  const stepLabels = ['品牌信息', '选网红', '选风格', '预览脚本', '生成']
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
            <Sparkles size={18} className="text-amber-400" /> 动漫营销视频
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">品牌产品 × AI网红 → 动漫风格营销短片 · {CREDIT_COST}积分</p>
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

      {/* Step: Brand Info */}
      {step === 'brand' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-zinc-400">品牌名称</Label>
            <Input
              placeholder="例如：泡泡玛特、完美日记"
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">产品名称</Label>
            <Input
              placeholder="例如：限定联名款唇膏"
              value={productName}
              onChange={e => setProductName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">产品卖点（可选）</Label>
            <Input
              placeholder="例如：持色24小时、蓝胖子联名设计"
              value={productDesc}
              onChange={e => setProductDesc(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">目标受众（可选）</Label>
            <Input
              placeholder="例如：18-25岁女性、二次元爱好者"
              value={targetAudience}
              onChange={e => setTargetAudience(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <Button
            onClick={() => setStep('influencer')}
            disabled={!brandName.trim() || !productName.trim()}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
          >
            下一步 <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>
      )}

      {/* Step: Influencer */}
      {step === 'influencer' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">选择品牌代言IP（推荐虚拟/品牌类网红）</p>
          <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
            {sortedInfluencers.map(inf => (
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
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-sm font-medium ${selectedInfluencer?.id === inf.id ? 'text-violet-300' : 'text-white'}`}>{inf.name}</span>
                  {(inf.type === 'virtual' || inf.type === 'brand') && (
                    <span className="text-xs px-1 rounded bg-amber-900/50 text-amber-400">推荐</span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 line-clamp-1">{inf.tagline}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('brand')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              上一步
            </Button>
            <Button
              onClick={() => setStep('style')}
              disabled={!selectedInfluencer}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
            >
              下一步 <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Style */}
      {step === 'style' && (
        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-zinc-400">动漫风格</Label>
            <div className="grid grid-cols-3 gap-2">
              {ANIME_STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setAnimeStyle(s.id)}
                  className={`p-3 rounded-lg border text-center transition-all ${animeStyle === s.id ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
                >
                  <div className="text-2xl mb-1">{s.emoji}</div>
                  <div className={`text-sm font-medium ${animeStyle === s.id ? 'text-violet-300' : 'text-white'}`}>{s.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-zinc-400">发布平台</Label>
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
              上一步
            </Button>
            <Button
              onClick={loadScript}
              disabled={!platform || loadingScript}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
            >
              {loadingScript ? <><Loader2 size={14} className="animate-spin mr-2" />生成脚本...</> : <>预览脚本 <ArrowRight size={14} className="ml-1" /></>}
            </Button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {/* Step: Script preview */}
      {step === 'script' && script && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">营销脚本预览（{animeStyle} 风格 · 共{script.length}段）</p>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {script.map((clip, i) => (
              <div key={i} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400">场景 {i + 1}</span>
                  <span className="text-xs text-zinc-500">{clip.duration}s</span>
                </div>
                {clip.dialogue && <p className="text-sm text-zinc-200 leading-relaxed">{clip.dialogue}</p>}
                {clip.shot_description && (
                  <p className="text-xs text-zinc-500 mt-1 italic">{clip.shot_description}</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('style')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              重新生成
            </Button>
            <Button
              onClick={() => setStep('generate')}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
            >
              确认脚本 <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Generate */}
      {step === 'generate' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">生成配置</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-zinc-500">品牌</span>
              <span className="text-zinc-300">{brandName}</span>
              <span className="text-zinc-500">产品</span>
              <span className="text-zinc-300">{productName}</span>
              <span className="text-zinc-500">代言IP</span>
              <span className="text-zinc-300">{selectedInfluencer?.name}</span>
              <span className="text-zinc-500">动漫风格</span>
              <span className="text-zinc-300">{ANIME_STYLES.find(s => s.id === animeStyle)?.label}</span>
              <span className="text-zinc-500">平台</span>
              <span className="text-zinc-300">{platforms.find(p => p.value === platform)?.label} · {aspectRatio}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-900/20 border border-amber-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-amber-300">消耗积分</span>
              <span className="text-lg font-bold text-white">{CREDIT_COST}</span>
            </div>
            <div className="text-xs text-amber-600 mt-1">当前余额：{credits} 积分 → 剩余 {credits - CREDIT_COST} 积分</div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {credits < CREDIT_COST && (
            <p className="text-sm text-amber-400">积分不足，请先<a href="/credits" className="underline ml-1">充值</a></p>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('script')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              上一步
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || credits < CREDIT_COST}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submitting ? <><Loader2 size={14} className="animate-spin mr-2" />生成中...</> : <><CheckCircle2 size={14} className="mr-2" />确认生成 (-{CREDIT_COST}积分)</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
