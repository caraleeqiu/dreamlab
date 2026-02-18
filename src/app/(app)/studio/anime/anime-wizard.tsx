'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Sparkles, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Influencer, Language, ScriptClip } from '@/types'
import { PLATFORMS } from '@/lib/language'
import { UI, t } from '@/lib/i18n'

type Step = 'category' | 'brand' | 'influencer' | 'format' | 'script' | 'generate'
type ProductCategory = 'eat' | 'wear' | 'play' | 'use'
type VideoFormat = 'voiceover' | 'drama' | 'other'

interface Props {
  lang: Language
  credits: number
  influencers: Influencer[]
}

export default function AnimeWizard({ lang, credits, influencers }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('category')
  const [productCategory, setProductCategory] = useState<ProductCategory | null>(null)
  const [brandName, setBrandName] = useState('')
  const [productName, setProductName] = useState('')
  const [productDesc, setProductDesc] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null)
  const [platform, setPlatform] = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [videoFormat, setVideoFormat] = useState<VideoFormat | null>(null)
  const [duration, setDuration] = useState<5 | 10 | 15>(10)
  const [script, setScript] = useState<ScriptClip[] | null>(null)
  const [loadingScript, setLoadingScript] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const platforms = PLATFORMS[lang]
  const CREDIT_COST = 50

  const ANIME_STYLES = [
    { id: 'cyberpunk', label: lang === 'zh' ? '赛博朋克' : 'Cyberpunk',    desc: lang === 'zh' ? '霓虹都市·科技感' : 'Neon city · tech vibes', emoji: '🌆' },
    { id: 'ancient',   label: lang === 'zh' ? '古风'    : 'Ancient',       desc: lang === 'zh' ? '水墨·东方美学'   : 'Ink brush · oriental',   emoji: '🏮' },
    { id: 'modern',    label: lang === 'zh' ? '现代都市' : 'Modern',        desc: lang === 'zh' ? '时尚·生活感'     : 'Fashion · lifestyle',    emoji: '🏙️' },
    { id: 'cute',      label: lang === 'zh' ? '二次元'  : 'Kawaii',        desc: lang === 'zh' ? '萌系·Q版'        : 'Cute · chibi style',     emoji: '🌸' },
    { id: 'fantasy',   label: lang === 'zh' ? '奇幻'    : 'Fantasy',       desc: lang === 'zh' ? '魔法世界·史诗感' : 'Magic world · epic',     emoji: '✨' },
    { id: 'minimal',   label: lang === 'zh' ? '极简'    : 'Minimal',       desc: lang === 'zh' ? '纯净·高端感'     : 'Clean · premium',        emoji: '⬜' },
  ]

  const PRODUCT_CATEGORIES: Array<{ id: ProductCategory; emoji: string; label: string; labelEn: string; desc: string; descEn: string; recommended: string[] }> = [
    {
      id: 'eat', emoji: '🍜',
      label: '吃', labelEn: 'Food',
      desc: '食品·饮品·零食·餐饮品牌', descEn: 'Food · Drinks · Snacks · Restaurants',
      recommended: ['luffy', 'gintoki', 'atlas'],
    },
    {
      id: 'wear', emoji: '👗',
      label: '穿', labelEn: 'Fashion',
      desc: '服装·美妆·时尚配饰', descEn: 'Clothing · Beauty · Fashion accessories',
      recommended: ['ellie', 'aria', 'loopy'],
    },
    {
      id: 'play', emoji: '🎮',
      label: '玩', labelEn: 'Explore',
      desc: '探店·旅游·游戏·娱乐体验', descEn: 'Venues · Travel · Games · Entertainment',
      recommended: ['atlas', 'gintoki', 'tanjiro'],
    },
    {
      id: 'use', emoji: '🔧',
      label: '用', labelEn: 'Tools',
      desc: '数码·工具·家居·效率类产品', descEn: 'Tech · Tools · Home · Productivity',
      recommended: ['zane', 'kai', 'quinn'],
    },
  ]

  // Sort influencers: category-recommended first, then virtual/brand, then others
  const recommendedSlugs = productCategory
    ? (PRODUCT_CATEGORIES.find(c => c.id === productCategory)?.recommended ?? [])
    : []

  const sortedInfluencers = [
    ...influencers.filter(i => recommendedSlugs.includes(i.slug ?? '')),
    ...influencers.filter(i => !recommendedSlugs.includes(i.slug ?? '') && (i.type === 'virtual' || i.type === 'brand')),
    ...influencers.filter(i => !recommendedSlugs.includes(i.slug ?? '') && i.type !== 'virtual' && i.type !== 'brand'),
  ]

  async function loadScript() {
    if (!selectedInfluencer || !brandName || !productName || !videoFormat) return
    setLoadingScript(true)
    setError('')
    try {
      const res = await fetch('/api/studio/anime/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName, productName, productDesc, targetAudience, productCategory, videoFormat, animeStyle: autoAnimeStyle, influencer: selectedInfluencer, lang }),
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
    if (!selectedInfluencer || !brandName || !productName || !videoFormat || !script) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/studio/anime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName, productName, productDesc, targetAudience, productCategory, videoFormat, animeStyle: autoAnimeStyle, influencerId: selectedInfluencer.id, platform, aspectRatio, duration, script, lang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t(lang, UI.common.error))
      router.push(`/jobs/${data.jobId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t(lang, UI.common.error))
      setSubmitting(false)
    }
  }

  // Auto-determine anime style from category + influencer type
  const autoAnimeStyle = (() => {
    if (productCategory === 'wear') return 'modern'
    if (productCategory === 'eat') {
      return selectedInfluencer?.type === 'virtual' || selectedInfluencer?.type === 'brand' ? 'cute' : 'modern'
    }
    if (productCategory === 'play') return 'fantasy'
    if (productCategory === 'use') return 'cyberpunk'
    return 'modern'
  })()

  const VIDEO_FORMATS: Array<{ id: VideoFormat; emoji: string; label: string; labelEn: string; desc: string; descEn: string }> = [
    { id: 'voiceover', emoji: '🎙️', label: '口播类', labelEn: 'Voiceover', desc: '角色直接出镜说品，一人讲述', descEn: 'Character speaks directly to camera' },
    { id: 'drama',     emoji: '🎬', label: '剧情类', labelEn: 'Drama/Skit', desc: '有冲突有起伏，产品是解法', descEn: 'Story arc, product as the solution' },
    { id: 'other',     emoji: '✂️', label: '其他', labelEn: 'Other', desc: 'AMV剪辑·种草·氛围向·创意不限', descEn: 'AMV edit · vibe · freestyle creative' },
  ]

  const RATIOS = [
    { ratio: '9:16', label: '9:16', platforms: lang === 'zh' ? '抖音 / 小红书 / 微博' : 'TikTok / Instagram / YouTube Shorts' },
    { ratio: '16:9', label: '16:9', platforms: lang === 'zh' ? 'B站 / 横版' : 'YouTube / Landscape' },
    { ratio: '1:1',  label: '1:1',  platforms: lang === 'zh' ? '方形 / 广告位' : 'Square / Ad placement' },
  ]

  const DURATIONS: Array<{ value: 5 | 10 | 15; label: string }> = [
    { value: 5,  label: lang === 'zh' ? '5s · 极短' : '5s · Ultra short' },
    { value: 10, label: lang === 'zh' ? '10s · 推荐' : '10s · Recommended' },
    { value: 15, label: lang === 'zh' ? '15s · 完整' : '15s · Full' },
  ]

  const steps: Step[] = ['category', 'brand', 'influencer', 'format', 'script', 'generate']
  const stepLabels = lang === 'zh'
    ? ['分类', '品牌', '选角', '格式', '脚本', '生成']
    : ['Category', 'Brand', 'Character', 'Format', 'Script', 'Generate']
  const stepIndex = steps.indexOf(step)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles size={18} className="text-amber-400" /> {t(lang, UI.wizard.animeTitle)}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">{t(lang, UI.wizard.animeSubtitle)} · {CREDIT_COST} {t(lang, UI.wizard.credits)}</p>
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
            {i < steps.length - 1 && <div className={`flex-1 h-px ${i < stepIndex ? 'bg-violet-600' : 'bg-zinc-800'}`} />}
          </div>
        ))}
      </div>

      {step === 'category' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            {lang === 'zh' ? '你要做哪类产品的营销视频？' : 'What type of product are you marketing?'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {PRODUCT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setProductCategory(cat.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  productCategory === cat.id
                    ? 'border-violet-500 bg-violet-600/10'
                    : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                }`}
              >
                <div className="text-3xl mb-2">{cat.emoji}</div>
                <div className={`font-semibold text-lg mb-0.5 ${productCategory === cat.id ? 'text-violet-300' : 'text-white'}`}>
                  {lang === 'zh' ? cat.label : cat.labelEn}
                </div>
                <div className="text-xs text-zinc-500">{lang === 'zh' ? cat.desc : cat.descEn}</div>
              </button>
            ))}
          </div>
          <Button
            onClick={() => setStep('brand')}
            disabled={!productCategory}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
          >
            {lang === 'zh' ? '下一步' : 'Next'} <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>
      )}

      {step === 'brand' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{t(lang, UI.wizard.animeBrand)}</Label>
            <Input
              placeholder={lang === 'zh' ? '例如：泡泡玛特、完美日记' : 'e.g. Pop Mart, Fenty Beauty'}
              value={brandName} onChange={e => setBrandName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{t(lang, UI.wizard.animeProduct)}</Label>
            <Input
              placeholder={lang === 'zh' ? '例如：限定联名款唇膏' : 'e.g. Limited edition collab lipstick'}
              value={productName} onChange={e => setProductName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{t(lang, UI.wizard.animePoints)}</Label>
            <Input
              placeholder={lang === 'zh' ? '例如：持色24小时、联名设计' : 'e.g. 24h wear, collab design'}
              value={productDesc} onChange={e => setProductDesc(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{t(lang, UI.wizard.animeAudience)}</Label>
            <Input
              placeholder={lang === 'zh' ? '例如：18-25岁女性、二次元爱好者' : 'e.g. 18-25 female, anime fans'}
              value={targetAudience} onChange={e => setTargetAudience(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
          </div>
          <Button onClick={() => setStep('influencer')} disabled={!brandName.trim() || !productName.trim()}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white">
            {t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>
      )}

      {step === 'influencer' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">{t(lang, UI.wizard.animePickInf)}</p>
          <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
            {sortedInfluencers.map(inf => (
              <button key={inf.id} onClick={() => setSelectedInfluencer(inf)}
                className={`p-3 rounded-xl border text-left transition-all ${selectedInfluencer?.id === inf.id ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}>
                {inf.frontal_image_url
                  ? <img src={inf.frontal_image_url} alt={inf.name} className="w-full aspect-square object-cover rounded-lg mb-2" />
                  : <div className="w-full aspect-square rounded-lg bg-zinc-700 mb-2 flex items-center justify-center text-2xl">
                      {inf.type === 'animal' ? '🐾' : inf.type === 'virtual' ? '🤖' : inf.type === 'brand' ? '✨' : '👤'}
                    </div>}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-sm font-medium ${selectedInfluencer?.id === inf.id ? 'text-violet-300' : 'text-white'}`}>{inf.name}</span>
                  {recommendedSlugs.includes(inf.slug ?? '') && (
                    <span className="text-xs px-1 rounded bg-amber-900/50 text-amber-400">{lang === 'zh' ? '推荐' : 'Rec'}</span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 line-clamp-1">{inf.tagline}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('brand')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">{t(lang, UI.wizard.prevBtn)}</Button>
            <Button onClick={() => setStep('format')} disabled={!selectedInfluencer} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
              {t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === 'format' && (
        <div className="space-y-5">
          {/* 视频格式 */}
          <div className="space-y-3">
            <Label className="text-zinc-400">{lang === 'zh' ? '视频格式' : 'Video Format'}</Label>
            <div className="grid grid-cols-3 gap-2">
              {VIDEO_FORMATS.map(f => (
                <button key={f.id} onClick={() => setVideoFormat(f.id)}
                  className={`p-3 rounded-lg border text-center transition-all ${videoFormat === f.id ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}>
                  <div className="text-2xl mb-1">{f.emoji}</div>
                  <div className={`text-sm font-medium ${videoFormat === f.id ? 'text-violet-300' : 'text-white'}`}>{lang === 'zh' ? f.label : f.labelEn}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 leading-tight">{lang === 'zh' ? f.desc : f.descEn}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 画面比例（带平台提示） */}
          <div className="space-y-3">
            <Label className="text-zinc-400">{lang === 'zh' ? '画面比例' : 'Aspect Ratio'}</Label>
            <div className="grid grid-cols-3 gap-2">
              {RATIOS.map(r => (
                <button key={r.ratio} onClick={() => { setAspectRatio(r.ratio); setPlatform(r.ratio === '9:16' ? (lang === 'zh' ? 'douyin' : 'tiktok') : r.ratio === '16:9' ? (lang === 'zh' ? 'bilibili' : 'youtube') : 'other') }}
                  className={`p-3 rounded-lg border transition-all text-center ${aspectRatio === r.ratio ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}>
                  <div className={`text-sm font-bold mb-1 ${aspectRatio === r.ratio ? 'text-violet-300' : 'text-white'}`}>{r.label}</div>
                  <div className="text-xs text-zinc-600 leading-snug">{r.platforms}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 时长 */}
          <div className="space-y-3">
            <Label className="text-zinc-400">{lang === 'zh' ? '每段时长' : 'Clip Duration'}</Label>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map(d => (
                <button key={d.value} onClick={() => setDuration(d.value)}
                  className={`p-3 rounded-lg border text-center transition-all ${duration === d.value ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}>
                  <div className={`text-sm font-medium ${duration === d.value ? 'text-violet-300' : 'text-white'}`}>{d.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('influencer')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">{t(lang, UI.wizard.prevBtn)}</Button>
            <Button onClick={loadScript} disabled={!videoFormat || loadingScript} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
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
            {t(lang, UI.wizard.scriptPreview)}（{VIDEO_FORMATS.find(f => f.id === videoFormat)?.[lang === 'zh' ? 'label' : 'labelEn']} · {lang === 'zh' ? `共${script.length}段` : `${script.length} segments`}）
          </p>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {script.map((clip, i) => (
              <div key={i} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400">{lang === 'zh' ? '场景' : 'Scene'} {i + 1}</span>
                  <span className="text-xs text-zinc-500">{clip.duration}s</span>
                </div>
                {clip.dialogue && <p className="text-sm text-zinc-200 leading-relaxed">{clip.dialogue}</p>}
                {clip.shot_description && <p className="text-xs text-zinc-500 mt-1 italic">{clip.shot_description}</p>}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('format')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">{t(lang, UI.wizard.regenerateBtn)}</Button>
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
              <span className="text-zinc-500">{t(lang, UI.wizard.animeBrand)}</span><span className="text-zinc-300">{brandName}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.animeProduct)}</span><span className="text-zinc-300">{productName}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '代言角色' : 'Character'}</span><span className="text-zinc-300">{selectedInfluencer?.name}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '视频格式' : 'Format'}</span><span className="text-zinc-300">{VIDEO_FORMATS.find(f => f.id === videoFormat)?.[lang === 'zh' ? 'label' : 'labelEn']}</span>
              <span className="text-zinc-500">{lang === 'zh' ? '比例·时长' : 'Ratio · Duration'}</span><span className="text-zinc-300">{aspectRatio} · {duration}s</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-amber-900/20 border border-amber-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-amber-300">{t(lang, UI.wizard.cost)}</span>
              <span className="text-lg font-bold text-white">{CREDIT_COST}</span>
            </div>
            <div className="text-xs text-amber-600 mt-1">
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
