'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Loader2, CheckCircle2,
  Link as LinkIcon, PenLine, FileText, Image as ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Influencer, Language, ScriptClip } from '@/types'
import { PLATFORMS } from '@/lib/language'
import { UI, t } from '@/lib/i18n'

type Step = 'input' | 'diagrams' | 'influencer' | 'platform' | 'script' | 'generate'
type InputMode = 'text' | 'url'

interface EduContent {
  title: string
  summary: string
  keyPoints: string[]
  difficulty: string
  suggestedDuration: number
  sourceType: string
}

interface DiagramResult {
  jobId: string
  imageUrls: string[]
}

interface Props {
  lang: Language
  credits: number
  influencers: Influencer[]
}

const CREDIT_COST = 40

const STEPS: Step[] = ['input', 'diagrams', 'influencer', 'platform', 'script', 'generate']
const STEP_LABELS: Record<Language, string[]> = {
  zh: ['输入', '分镜图', '主播', '平台', '脚本', '生成'],
  en: ['Input', 'Diagrams', 'Host', 'Platform', 'Script', 'Generate'],
}

export default function EduPaperWizard({ lang, credits, influencers }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [inputMode, setInputMode] = useState<InputMode>('url')
  const [textInput, setTextInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [content, setContent] = useState<EduContent | null>(null)
  const [diagrams, setDiagrams] = useState<DiagramResult[]>([])
  const [diagramsLoading, setDiagramsLoading] = useState(false)
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
  const stepLabels = STEP_LABELS[lang]
  const stepIndex = STEPS.indexOf(step)

  // Auto-generate diagrams when entering the diagrams step
  useEffect(() => {
    if (step === 'diagrams' && content && diagrams.length === 0 && !diagramsLoading) {
      void generateDiagrams()
    }
  }, [step])

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
      setDiagrams([])
      setStep('diagrams')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t(lang, UI.common.error))
    } finally {
      setExtracting(false)
    }
  }

  async function generateDiagrams() {
    if (!content) return
    setDiagramsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/studio/edu/paper/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Diagram generation failed')
      setDiagrams(data.diagrams ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Diagram generation failed')
    } finally {
      setDiagramsLoading(false)
    }
  }

  async function loadScript() {
    if (!selectedInfluencer || !content || !platform) return
    setLoadingScript(true)
    setError('')
    try {
      const res = await fetch('/api/studio/edu/paper/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          influencer: selectedInfluencer,
          diagrams,
          platform,
          aspectRatio,
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
      const res = await fetch('/api/studio/edu/paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          influencerId: selectedInfluencer.id,
          platform,
          aspectRatio,
          script,
          diagrams,
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
            <FileText size={18} className="text-sky-400" />
            {isZh ? '论文解读' : 'Paper Explainer'}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isZh ? '论文 → Napkin 分镜图 → 网红 PiP 解读视频' : 'Paper → Napkin diagrams → Influencer PiP explainer'} · {CREDIT_COST} {t(lang, UI.wizard.credits)}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1 mb-8">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0
              ${i < stepIndex ? 'bg-sky-600 text-white' : i === stepIndex ? 'bg-sky-600/50 text-white ring-2 ring-sky-400/30' : 'bg-zinc-800 text-zinc-600'}`}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === stepIndex ? 'text-white' : 'text-zinc-600'}`}>{label}</span>
            {i < stepLabels.length - 1 && <div className={`flex-1 h-px ${i < stepIndex ? 'bg-sky-600' : 'bg-zinc-800'}`} />}
          </div>
        ))}
      </div>

      {/* Step: Input */}
      {step === 'input' && (
        <div className="space-y-5">
          <div className="flex gap-2">
            {(['url', 'text'] as InputMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${inputMode === mode ? 'border-sky-500 bg-sky-600/10 text-sky-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}
              >
                {mode === 'url' ? <LinkIcon size={12} /> : <PenLine size={12} />}
                {mode === 'url' ? (isZh ? 'arXiv / 文章链接' : 'arXiv / URL') : (isZh ? '粘贴摘要' : 'Paste abstract')}
              </button>
            ))}
          </div>

          {inputMode === 'url' ? (
            <div className="space-y-1.5">
              <Label className="text-zinc-400">{isZh ? 'arXiv 链接 / 论文 URL' : 'arXiv link / Paper URL'}</Label>
              <Input
                placeholder={isZh ? 'https://arxiv.org/abs/2503.xxxxx' : 'https://arxiv.org/abs/2503.xxxxx'}
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 font-mono text-sm"
              />
              <p className="text-xs text-zinc-600">{isZh ? '支持 arXiv、bioRxiv、任意公开论文链接' : 'Supports arXiv, bioRxiv, any public paper URL'}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-zinc-400">{isZh ? '摘要 / 概念内容' : 'Abstract / concept text'}</Label>
              <Textarea
                placeholder={isZh ? '粘贴论文摘要、研究结论，或直接输入科学概念…' : 'Paste paper abstract, findings, or enter a scientific concept…'}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                rows={5}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none text-sm"
              />
            </div>
          )}

          <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-xs text-zinc-500 space-y-1">
            <p className="font-medium text-zinc-400">{isZh ? '生成流程' : 'What happens next'}</p>
            <p>1. {isZh ? 'AI 提炼核心论点和知识点' : 'AI extracts key points'}</p>
            <p>2. {isZh ? 'Napkin AI 为每个知识点生成概念分镜图' : 'Napkin AI generates concept diagrams per key point'}</p>
            <p>3. {isZh ? 'AI 网红出镜解读，分镜图全屏展示，主播 PiP 角落' : 'Influencer PiP in corner, diagram full-screen background'}</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            onClick={handleExtract}
            disabled={extracting || !(inputMode === 'url' ? urlInput.trim() : textInput.trim())}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white"
          >
            {extracting
              ? <><Loader2 size={14} className="animate-spin mr-2" />{isZh ? '解析中…' : 'Extracting…'}</>
              : <>{isZh ? '解析内容' : 'Extract content'} <ArrowRight size={14} className="ml-1" /></>}
          </Button>
        </div>
      )}

      {/* Step: Diagrams */}
      {step === 'diagrams' && content && (
        <div className="space-y-5">
          {/* Content summary */}
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-2">
            <h3 className="text-sm font-semibold text-white">{content.title}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{content.summary}</p>
          </div>

          {/* Diagrams per key point */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-zinc-400">{isZh ? `分镜概念图（${content.keyPoints.length} 张）` : `Concept diagrams (${content.keyPoints.length})`}</Label>
              {diagramsLoading && (
                <span className="flex items-center gap-1 text-xs text-sky-400">
                  <Loader2 size={11} className="animate-spin" />
                  {isZh ? 'Napkin 生成中…' : 'Generating with Napkin…'}
                </span>
              )}
              {!diagramsLoading && diagrams.length > 0 && (
                <button onClick={generateDiagrams} className="text-xs text-zinc-500 hover:text-sky-400 transition-colors">
                  {isZh ? '重新生成' : 'Regenerate'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {content.keyPoints.map((kp, i) => {
                const diag = diagrams[i]
                const firstUrl = diag?.imageUrls?.[0]
                return (
                  <div key={i} className="rounded-lg border border-zinc-700 bg-zinc-800/50 overflow-hidden">
                    {/* Diagram image or placeholder */}
                    <div className="aspect-video bg-zinc-900 flex items-center justify-center relative">
                      {firstUrl ? (
                        <img src={firstUrl} alt={`Diagram ${i + 1}`} className="w-full h-full object-contain" />
                      ) : diagramsLoading ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <Loader2 size={18} className="animate-spin text-sky-500" />
                          <span className="text-xs text-zinc-600">{isZh ? '生成中…' : 'Generating…'}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <ImageIcon size={18} className="text-zinc-600" />
                          <span className="text-xs text-zinc-600">{isZh ? '未生成' : 'Not generated'}</span>
                        </div>
                      )}
                      <span className="absolute top-1.5 left-1.5 text-xs bg-sky-900/80 text-sky-300 px-1.5 py-0.5 rounded">
                        #{i + 1}
                      </span>
                    </div>
                    {/* Key point label */}
                    <div className="p-2">
                      <p className="text-xs text-zinc-400 line-clamp-2">{kp}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('input')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button
              onClick={() => setStep('influencer')}
              disabled={diagramsLoading}
              className="flex-1 bg-sky-600 hover:bg-sky-700 text-white"
            >
              {diagramsLoading
                ? <><Loader2 size={14} className="animate-spin mr-2" />{isZh ? '等待分镜图…' : 'Waiting for diagrams…'}</>
                : <>{t(lang, UI.wizard.nextBtn)} <ArrowRight size={14} className="ml-1" /></>}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Influencer */}
      {step === 'influencer' && content && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-2">
            <h3 className="text-sm font-semibold text-white">{content.title}</h3>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span>{isZh ? `${content.keyPoints.length} 个知识点` : `${content.keyPoints.length} key points`}</span>
              <span>·</span>
              <span className={diagrams.filter(d => d.imageUrls.length > 0).length > 0 ? 'text-sky-400' : 'text-zinc-600'}>
                {diagrams.filter(d => d.imageUrls.length > 0).length}/{content.keyPoints.length} {isZh ? '张分镜图' : 'diagrams'}
              </span>
            </div>
          </div>

          <p className="text-sm text-zinc-400">{isZh ? '选择解读主播（将作为 PiP 出现在分镜图角落）' : 'Select host influencer (appears as PiP in corner of diagram)'}</p>

          <div className="grid grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
            {influencers.map(inf => (
              <button
                key={inf.id}
                onClick={() => setSelectedInfluencer(inf)}
                className={`p-3 rounded-xl border text-left transition-all ${selectedInfluencer?.id === inf.id ? 'border-sky-500 bg-sky-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
              >
                {inf.frontal_image_url
                  ? <img src={inf.frontal_image_url} alt={inf.name} className="w-full aspect-square object-cover rounded-lg mb-2" />
                  : <div className="w-full aspect-square rounded-lg bg-zinc-700 mb-2 flex items-center justify-center text-2xl">📚</div>
                }
                <div className={`text-sm font-medium ${selectedInfluencer?.id === inf.id ? 'text-sky-300' : 'text-white'}`}>{inf.name}</div>
                <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{inf.tagline}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('diagrams')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button onClick={() => setStep('platform')} disabled={!selectedInfluencer} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white">
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
                  className={`p-3 rounded-lg border transition-all text-center ${platform === p.value ? 'border-sky-500 bg-sky-600/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}
                >
                  <div className="text-xl mb-1">{p.icon}</div>
                  <div className={`text-xs ${platform === p.value ? 'text-sky-300' : 'text-zinc-300'}`}>{p.label}</div>
                  <div className="text-xs text-zinc-600">{p.aspectRatio}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('influencer')} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {t(lang, UI.wizard.prevBtn)}
            </Button>
            <Button onClick={loadScript} disabled={!platform || loadingScript} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white">
              {loadingScript
                ? <><Loader2 size={14} className="animate-spin mr-2" />{t(lang, UI.wizard.scriptLoading)}</>
                : <>{t(lang, UI.wizard.scriptPreview)} <ArrowRight size={14} className="ml-1" /></>}
            </Button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {/* Step: Script preview with diagram references */}
      {step === 'script' && script && content && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            {isZh ? `脚本预览（共 ${script.length} 段，每段对应一张分镜图）` : `Script preview (${script.length} clips, each aligned with a diagram)`}
          </p>
          <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
            {script.map((clip, i) => {
              // Find the referenced diagram
              const diagIdx = (clip as ScriptClip & { diagram_index?: number }).diagram_index ?? -1
              const diag = diagrams[diagIdx]
              const diagUrl = diag?.imageUrls?.[0]
              return (
                <div key={i} className="rounded-lg border border-zinc-700 bg-zinc-800/50 overflow-hidden">
                  {/* Diagram thumbnail + metadata row */}
                  <div className="flex items-start gap-3 p-3">
                    <div className="w-16 h-12 rounded bg-zinc-900 border border-zinc-700 shrink-0 flex items-center justify-center overflow-hidden">
                      {diagUrl
                        ? <img src={diagUrl} alt="" className="w-full h-full object-contain" />
                        : <ImageIcon size={14} className="text-zinc-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-sky-900/50 text-sky-400">{t(lang, UI.wizard.segment)} {i + 1}</span>
                        <span className="text-xs text-zinc-500">{clip.duration}s</span>
                        {diagIdx >= 0 && <span className="text-xs text-zinc-600">图 #{diagIdx + 1}</span>}
                      </div>
                      <p className="text-sm text-zinc-200 leading-relaxed">{clip.dialogue}</p>
                      {clip.shot_description && (
                        <p className="text-xs text-zinc-600 mt-1 italic line-clamp-2">{clip.shot_description}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep('platform'); loadScript() }} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800" disabled={loadingScript}>
              {loadingScript ? <Loader2 size={14} className="animate-spin" /> : t(lang, UI.wizard.regenerateBtn)}
            </Button>
            <Button onClick={() => setStep('generate')} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white">
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
              <span className="text-zinc-500">{isZh ? '论文' : 'Paper'}</span>
              <span className="text-zinc-300 text-xs line-clamp-1">{content.title}</span>
              <span className="text-zinc-500">{isZh ? '知识点' : 'Key points'}</span>
              <span className="text-zinc-300">{content.keyPoints.length}</span>
              <span className="text-zinc-500">{isZh ? '分镜图' : 'Diagrams'}</span>
              <span className={diagrams.filter(d => d.imageUrls.length > 0).length > 0 ? 'text-sky-300' : 'text-zinc-500'}>
                {diagrams.filter(d => d.imageUrls.length > 0).length}/{content.keyPoints.length}
              </span>
              <span className="text-zinc-500">{isZh ? '主播' : 'Host'}</span>
              <span className="text-zinc-300">{selectedInfluencer.name}</span>
              <span className="text-zinc-500">{t(lang, UI.wizard.platform)}</span>
              <span className="text-zinc-300">{platforms.find(p => p.value === platform)?.label} · {aspectRatio}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-xs text-zinc-500 space-y-1">
            <p className="font-medium text-zinc-400">{isZh ? '视频合成说明' : 'Video assembly'}</p>
            <p>· {isZh ? 'Kling 生成主播视频片段' : 'Kling generates influencer clips'}</p>
            <p>· {isZh ? 'Napkin 分镜图全屏背景 + 主播 PiP 右下角' : 'Napkin diagram full-screen + influencer PiP bottom-right'}</p>
            <p>· {isZh ? 'ffmpeg 自动合成画中画 + 字幕 + 拼接' : 'ffmpeg auto-composes PiP + subtitles + stitch'}</p>
          </div>

          <div className="p-4 rounded-xl bg-sky-900/20 border border-sky-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-sky-300">{t(lang, UI.wizard.cost)}</span>
              <span className="text-lg font-bold text-white">{CREDIT_COST}</span>
            </div>
            <div className="text-xs text-sky-500 mt-1">
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
            <Button onClick={handleSubmit} disabled={submitting || credits < CREDIT_COST} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white">
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
