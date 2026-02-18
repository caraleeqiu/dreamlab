'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { X, Upload, Loader2, ChevronLeft } from 'lucide-react'
import type { Influencer, InfluencerType } from '@/types'

const STEPS = ['类型', '基本信息', '形象', '声音', '保存']

const TYPE_OPTIONS: { value: InfluencerType; label: string; emoji: string; desc: string }[] = [
  { value: 'human',   label: '真人网红',  emoji: '🧑', desc: '李佳琦、美妆博主' },
  { value: 'animal',  label: '动物网红',  emoji: '🐾', desc: '小花大黄、会说话的柴犬' },
  { value: 'virtual', label: '虚拟角色',  emoji: '🎭', desc: '洛天依、原创AI女友' },
  { value: 'brand',   label: '品牌IP',    emoji: '🏷️', desc: '天猫的猫、瑞幸鹿角怪' },
]

const PERSONALITY_OPTIONS = ['一针见血', '冷幽默', '零废话', '真诚', '毒舌', '阳光', '严肃', '活泼', '知识型', '幽默', '感性', '理性', '治愈', '霸气', '萌系']
const DOMAIN_OPTIONS = ['科技', '美妆', '生活vlog', '情感', '娱乐', '财经', '健康', '美食', '旅行', '游戏', '时尚', '教育', '汽车', '宠物', '体育']
const VOICE_OPTIONS = [
  { value: 'dry low-key British female voice, low pitch, slow deliberate pace, minimal emotional variation, slightly wry', label: '低冷英式女声' },
  { value: 'warm American female voice, medium pace, friendly and trustworthy, slight smile in tone', label: '温暖美式女声' },
  { value: 'bright American female voice, fast-paced, casual and enthusiastic, slight vocal fry', label: '活力美式女声' },
  { value: 'deep American male voice, slow deliberate pace, minimal words, weighted pauses', label: '低沉男声' },
  { value: 'earnest American male voice, medium-high pitch, formal and serious delivery', label: '正式男声' },
  { value: 'high-energy American male voice, fast-paced, full of enthusiasm', label: '高能男声' },
]

interface Props {
  onSuccess: (inf: Influencer) => void
  onClose: () => void
  isFirst: boolean
  editInfluencer?: Influencer
}

export default function CreateWizard({ onSuccess, onClose, isFirst, editInfluencer }: Props) {
  const isEdit = !!editInfluencer
  const [step, setStep] = useState(isEdit ? 1 : 0)
  const [loading, setLoading] = useState(false)
  const [generatingImg, setGeneratingImg] = useState(false)
  const [generatingTts, setGeneratingTts] = useState(false)
  const [imageUrl, setImageUrl] = useState(editInfluencer?.frontal_image_url || '')
  const [ttsUrl, setTtsUrl] = useState('')
  const [imagePrompt, setImagePrompt] = useState('')

  const [form, setForm] = useState({
    type: (editInfluencer?.type ?? '') as InfluencerType | '',
    name: editInfluencer?.name ?? '',
    tagline: editInfluencer?.tagline ?? '',
    personality: editInfluencer?.personality ?? [] as string[],
    domains: editInfluencer?.domains ?? [] as string[],
    speaking_style: editInfluencer?.speaking_style ?? '',
    catchphrases: editInfluencer?.catchphrases?.length
      ? [...editInfluencer.catchphrases, '', ''].slice(0, 3)
      : ['', '', ''],
    chat_style: (editInfluencer?.chat_style ?? 'dominant') as 'dominant' | 'supportive' | 'debate',
    forbidden: editInfluencer?.forbidden ?? '',
    voice_prompt: editInfluencer?.voice_prompt ?? VOICE_OPTIONS[0].value,
  })

  function toggleTag(arr: string[], val: string, max: number): string[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : arr.length < max ? [...arr, val] : arr
  }

  async function generateImage() {
    if (!imagePrompt) return
    setGeneratingImg(true)
    try {
      const res = await fetch('/api/influencers/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt, is_first: isFirst }),
      })
      const data = await res.json()
      if (data.url) setImageUrl(data.url)
    } finally {
      setGeneratingImg(false)
    }
  }

  async function generateTts() {
    setGeneratingTts(true)
    try {
      const res = await fetch('/api/influencers/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_prompt: form.voice_prompt,
          sample_text: `Hi, I'm ${form.name}. ${form.tagline}`,
          is_first: isFirst,
        }),
      })
      const data = await res.json()
      if (data.url) setTtsUrl(data.url)
    } finally {
      setGeneratingTts(false)
    }
  }

  async function handleSubmit() {
    setLoading(true)
    try {
      const url = isEdit ? `/api/influencers/${editInfluencer!.id}` : '/api/influencers'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          catchphrases: form.catchphrases.filter(Boolean),
          frontal_image_url: imageUrl || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) onSuccess(data)
    } finally {
      setLoading(false)
    }
  }

  const canNext = () => {
    if (step === 0) return !!form.type
    if (step === 1) return !!form.name && !!form.tagline && form.personality.length > 0 && form.domains.length > 0
    return true
  }

  return (
    <div className="flex flex-col h-full">
      {/* 步骤指示器 */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors
              ${i < step ? 'bg-violet-600 text-white' :
                i === step ? 'bg-violet-600 text-white ring-2 ring-violet-400/30' :
                'bg-zinc-800 text-zinc-500'}`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`ml-1.5 text-xs ${i === step ? 'text-white' : 'text-zinc-500'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-zinc-700 mx-2" />}
          </div>
        ))}
      </div>

      {/* Step 0: 类型 */}
      {step === 0 && (
        <div className="grid grid-cols-2 gap-3">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setForm(f => ({ ...f, type: opt.value }))}
              className={`p-4 rounded-xl border text-left transition-all
                ${form.type === opt.value ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 hover:border-zinc-500'}`}
            >
              <div className="text-2xl mb-2">{opt.emoji}</div>
              <div className="font-medium text-sm text-white">{opt.label}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* Step 1: 基本信息 */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-zinc-400">名字 *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="例：小雪" className="bg-zinc-800 border-zinc-700 text-white" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">一句话人设 * <span className="text-zinc-600 font-normal">（50字内）</span></Label>
            <Input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
              placeholder="例：看透一切，只说值得说的那句" className="bg-zinc-800 border-zinc-700 text-white" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">性格标签 * <span className="text-zinc-600 font-normal">（最多3个）</span></Label>
            <div className="flex flex-wrap gap-1.5">
              {PERSONALITY_OPTIONS.map(tag => (
                <button key={tag} onClick={() => setForm(f => ({ ...f, personality: toggleTag(f.personality, tag, 3) }))}
                  className={`px-2.5 py-1 rounded-full text-xs transition-colors
                    ${form.personality.includes(tag) ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">主领域 * <span className="text-zinc-600 font-normal">（最多3个）</span></Label>
            <div className="flex flex-wrap gap-1.5">
              {DOMAIN_OPTIONS.map(tag => (
                <button key={tag} onClick={() => setForm(f => ({ ...f, domains: toggleTag(f.domains, tag, 3) }))}
                  className={`px-2.5 py-1 rounded-full text-xs transition-colors
                    ${form.domains.includes(tag) ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">口头禅 <span className="text-zinc-600 font-normal">（最多3个，选填）</span></Label>
            {form.catchphrases.map((cp, i) => (
              <Input key={i} value={cp} onChange={e => setForm(f => {
                const arr = [...f.catchphrases]; arr[i] = e.target.value; return { ...f, catchphrases: arr }
              })} placeholder={`口头禅 ${i + 1}`} className="bg-zinc-800 border-zinc-700 text-white mb-1.5" />
            ))}
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">说话风格 <span className="text-zinc-600 font-normal">（选填）</span></Label>
            <Textarea value={form.speaking_style} onChange={e => setForm(f => ({ ...f, speaking_style: e.target.value }))}
              placeholder="例：有量无废话，主动掌控节奏，冷不丁抛出精准到好笑的分析"
              className="bg-zinc-800 border-zinc-700 text-white resize-none" rows={2} />
          </div>
        </div>
      )}

      {/* Step 2: 形象 */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-400">描述形象，AI帮你生成</Label>
            <Textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)}
              placeholder="例：A sleek black cat with a small gold collar and name tag, sitting upright, minimal aesthetic, studio lighting, 9:16"
              className="bg-zinc-800 border-zinc-700 text-white resize-none" rows={3} />
            <Button onClick={generateImage} disabled={!imagePrompt || generatingImg}
              className="bg-violet-600 hover:bg-violet-700 text-white">
              {generatingImg ? <><Loader2 size={14} className="animate-spin mr-1.5" />生成中...</> : `AI 生成形象${isFirst ? '（免费）' : '（3积分）'}`}
            </Button>
          </div>
          {imageUrl && (
            <div className="relative w-32 h-44 rounded-xl overflow-hidden border border-zinc-700">
              <img src={imageUrl} alt="生成结果" className="w-full h-full object-cover" />
              <button onClick={() => setImageUrl('')}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-zinc-900/80 text-zinc-400">
                <X size={12} />
              </button>
            </div>
          )}
          <p className="text-xs text-zinc-600">也可以跳过，之后在编辑页重新生成（3积分/次）</p>
        </div>
      )}

      {/* Step 3: 声音 */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-400">选择声线</Label>
            <div className="space-y-2">
              {VOICE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setForm(f => ({ ...f, voice_prompt: opt.value }))}
                  className={`w-full px-4 py-3 rounded-lg border text-left text-sm transition-colors
                    ${form.voice_prompt === opt.value ? 'border-violet-500 bg-violet-600/10 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={generateTts} disabled={generatingTts}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {generatingTts ? <><Loader2 size={14} className="animate-spin mr-1.5" />生成中...</> : `预览声音${isFirst ? '（免费）' : '（2积分）'}`}
          </Button>
          {ttsUrl && (
            <audio controls src={ttsUrl} className="w-full mt-2" />
          )}
        </div>
      )}

      {/* Step 4: 保存确认 */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              {imageUrl && <img src={imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />}
              <div>
                <div className="font-semibold text-white">{form.name}</div>
                <div className="text-sm text-zinc-400">{form.tagline}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {form.personality.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
            </div>
          </div>
          <div className="text-sm text-zinc-500">
            {isEdit
              ? <><span className="text-green-400 font-medium">编辑免费</span><span>（修改不消耗积分）</span></>
              : <>创建费用：<span className="text-white font-medium">{isFirst ? '免费（首个网红）' : '10 积分'}</span></>
            }
          </div>
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex justify-between mt-auto pt-6">
        <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep(s => s - 1)}
          className="text-zinc-400 hover:text-white">
          {step === 0 ? '取消' : <><ChevronLeft size={16} />上一步</>}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            下一步
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {loading ? <><Loader2 size={14} className="animate-spin mr-1.5" />{isEdit ? '保存中...' : '创建中...'}</> : isEdit ? '保存修改' : '创建网红'}
          </Button>
        )}
      </div>
    </div>
  )
}
