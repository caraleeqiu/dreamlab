'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { X, Upload, Loader2, ChevronLeft } from 'lucide-react'
import type { Influencer, InfluencerType } from '@/types'
import { useLanguage } from '@/context/language-context'

// i18n strings
const i18n = {
  zh: {
    steps: ['类型', '基本信息', '形象', '声音', '保存'],
    types: [
      { value: 'human' as InfluencerType, label: '真人网红', emoji: '🧑', desc: '李佳琦、美妆博主' },
      { value: 'animal' as InfluencerType, label: '动物网红', emoji: '🐾', desc: '小花大黄、会说话的柴犬' },
      { value: 'virtual' as InfluencerType, label: '虚拟角色', emoji: '🎭', desc: '洛天依、原创AI女友' },
      { value: 'brand' as InfluencerType, label: '品牌IP', emoji: '🏷️', desc: '天猫的猫、瑞幸鹿角怪' },
    ],
    personality: ['一针见血', '冷幽默', '零废话', '真诚', '毒舌', '阳光', '严肃', '活泼', '知识型', '幽默', '感性', '理性', '治愈', '霸气', '萌系'],
    domains: ['科技', '美妆', '生活vlog', '情感', '娱乐', '财经', '健康', '美食', '旅行', '游戏', '时尚', '教育', '汽车', '宠物', '体育'],
    voices: [
      { value: 'dry low-key British female voice, low pitch, slow deliberate pace, minimal emotional variation, slightly wry', label: '低冷英式女声' },
      { value: 'warm American female voice, medium pace, friendly and trustworthy, slight smile in tone', label: '温暖美式女声' },
      { value: 'bright American female voice, fast-paced, casual and enthusiastic, slight vocal fry', label: '活力美式女声' },
      { value: 'deep American male voice, slow deliberate pace, minimal words, weighted pauses', label: '低沉男声' },
      { value: 'earnest American male voice, medium-high pitch, formal and serious delivery', label: '正式男声' },
      { value: 'high-energy American male voice, fast-paced, full of enthusiasm', label: '高能男声' },
    ],
    labels: {
      name: '名字',
      namePlaceholder: '例：小雪',
      tagline: '一句话人设',
      taglinePlaceholder: '例：看透一切，只说值得说的那句',
      taglineHint: '（50字内）',
      personality: '性格标签',
      personalityHint: '（最多3个）',
      customTag: '自定义标签...',
      pressEnter: '回车添加',
      domains: '主领域',
      domainsHint: '（最多3个）',
      customDomain: '自定义领域...',
      catchphrases: '口头禅',
      catchphrasesHint: '（最多3个，选填）',
      catchphrasePlaceholder: '口头禅',
      speakingStyle: '说话风格',
      speakingStylePlaceholder: '例：有量无废话，主动掌控节奏，冷不丁抛出精准到好笑的分析',
      optional: '（选填）',
      uploadImage: '方式一：上传图片',
      clickToUpload: '点击上传图片',
      or: '或',
      aiGenerate: '方式二：AI 生成',
      humanPromptPlaceholder: '例：28岁东亚女性，黑色长直发，淡妆，自信微笑，穿米色毛衣，半身照，室内自然光从左侧照入',
      otherPromptPlaceholder: '例：A sleek black cat with gold collar, sitting upright, studio lighting, 9:16',
      optimizePrompt: '优化 Prompt',
      optimizing: '优化中...',
      promptOptimized: '✓ Prompt 已优化，可直接生成或继续编辑',
      generateImage: '生成图片',
      generating: '生成中...',
      free: '（免费）',
      cost3: '（3积分）',
      cost2: '（2积分）',
      skipHint: '也可以跳过，之后在编辑页补充',
      humanImageTips: '系统已自动优化真人图像生成，描述越具体效果越好：',
      humanImageTip1: '年龄、性别、族裔（如：25岁亚洲女性）',
      humanImageTip2: '发型、发色（如：黑色短卷发、棕色长直发）',
      humanImageTip3: '表情神态（如：自信微笑、认真专注）',
      humanImageTip4: '服装（如：白色衬衫、黑色西装）',
      humanImageTip5: '光线环境（如：室内柔光、户外自然光）',
      selectVoice: '选择声线',
      recommended: '推荐',
      customVoice: '✨ 自定义声线',
      voiceDesc: '声线描述',
      voiceDescHint: '（英文效果更好）',
      voiceDescPlaceholder: '例：warm friendly female voice, medium pace, slight smile in tone, Chinese accent',
      voiceDescHelp: '描述音色、语速、情绪、口音等特征',
      previewVoice: '预览声音',
      cancel: '取消',
      prev: '上一步',
      next: '下一步',
      create: '创建网红',
      creating: '创建中...',
      save: '保存修改',
      saving: '保存中...',
      editFree: '编辑免费',
      editFreeHint: '（修改不消耗积分）',
      createCost: '创建费用：',
      firstFree: '免费（首个网红）',
      cost10: '10 积分',
      voiceRecommend: '根据性格推荐声线：',
      voiceMismatch: '当前声线与性格可能不太搭配，推荐：',
      personalityConflict: '可能有些矛盾，建议二选一',
      domainConflict: '受众差异较大，可能影响账号定位',
    },
  },
  en: {
    steps: ['Type', 'Basic Info', 'Avatar', 'Voice', 'Save'],
    types: [
      { value: 'human' as InfluencerType, label: 'Human', emoji: '🧑', desc: 'Beauty blogger, lifestyle creator' },
      { value: 'animal' as InfluencerType, label: 'Animal', emoji: '🐾', desc: 'Cute pets, talking animals' },
      { value: 'virtual' as InfluencerType, label: 'Virtual', emoji: '🎭', desc: 'Anime character, AI persona' },
      { value: 'brand' as InfluencerType, label: 'Brand IP', emoji: '🏷️', desc: 'Mascots, brand characters' },
    ],
    personality: ['Incisive', 'Dry humor', 'No fluff', 'Sincere', 'Sarcastic', 'Sunny', 'Serious', 'Lively', 'Knowledgeable', 'Humorous', 'Emotional', 'Rational', 'Healing', 'Powerful', 'Cute'],
    domains: ['Tech', 'Beauty', 'Lifestyle', 'Emotions', 'Entertainment', 'Finance', 'Health', 'Food', 'Travel', 'Gaming', 'Fashion', 'Education', 'Auto', 'Pets', 'Sports'],
    voices: [
      { value: 'dry low-key British female voice, low pitch, slow deliberate pace, minimal emotional variation, slightly wry', label: 'Cool British Female' },
      { value: 'warm American female voice, medium pace, friendly and trustworthy, slight smile in tone', label: 'Warm American Female' },
      { value: 'bright American female voice, fast-paced, casual and enthusiastic, slight vocal fry', label: 'Energetic American Female' },
      { value: 'deep American male voice, slow deliberate pace, minimal words, weighted pauses', label: 'Deep Male Voice' },
      { value: 'earnest American male voice, medium-high pitch, formal and serious delivery', label: 'Formal Male Voice' },
      { value: 'high-energy American male voice, fast-paced, full of enthusiasm', label: 'Energetic Male Voice' },
    ],
    labels: {
      name: 'Name',
      namePlaceholder: 'e.g. Luna',
      tagline: 'Tagline',
      taglinePlaceholder: 'e.g. Sees through everything, only says what matters',
      taglineHint: '(max 50 chars)',
      personality: 'Personality',
      personalityHint: '(max 3)',
      customTag: 'Custom tag...',
      pressEnter: 'Press Enter',
      domains: 'Domains',
      domainsHint: '(max 3)',
      customDomain: 'Custom domain...',
      catchphrases: 'Catchphrases',
      catchphrasesHint: '(max 3, optional)',
      catchphrasePlaceholder: 'Catchphrase',
      speakingStyle: 'Speaking Style',
      speakingStylePlaceholder: 'e.g. Concise, takes control, drops sharp insights unexpectedly',
      optional: '(optional)',
      uploadImage: 'Option 1: Upload Image',
      clickToUpload: 'Click to upload',
      or: 'or',
      aiGenerate: 'Option 2: AI Generate',
      humanPromptPlaceholder: 'e.g. 28yo Asian female, long black hair, light makeup, confident smile, beige sweater, half-body shot, natural indoor lighting',
      otherPromptPlaceholder: 'e.g. A sleek black cat with gold collar, sitting upright, studio lighting, 9:16',
      optimizePrompt: 'Optimize Prompt',
      optimizing: 'Optimizing...',
      promptOptimized: '✓ Prompt optimized, ready to generate or edit further',
      generateImage: 'Generate Image',
      generating: 'Generating...',
      free: '(Free)',
      cost3: '(3 credits)',
      cost2: '(2 credits)',
      skipHint: 'You can skip this and add later',
      humanImageTips: 'Tips for better results:',
      humanImageTip1: 'Age, gender, ethnicity (e.g. 25yo Asian female)',
      humanImageTip2: 'Hairstyle, color (e.g. short curly black hair)',
      humanImageTip3: 'Expression (e.g. confident smile, focused look)',
      humanImageTip4: 'Clothing (e.g. white shirt, black blazer)',
      humanImageTip5: 'Lighting (e.g. soft indoor, natural outdoor)',
      selectVoice: 'Select Voice',
      recommended: 'Recommended',
      customVoice: '✨ Custom Voice',
      voiceDesc: 'Voice Description',
      voiceDescHint: '(English works best)',
      voiceDescPlaceholder: 'e.g. warm friendly female voice, medium pace, slight smile in tone',
      voiceDescHelp: 'Describe tone, pace, emotion, accent',
      previewVoice: 'Preview Voice',
      cancel: 'Cancel',
      prev: 'Previous',
      next: 'Next',
      create: 'Create Influencer',
      creating: 'Creating...',
      save: 'Save Changes',
      saving: 'Saving...',
      editFree: 'Edit is free',
      editFreeHint: '(no credits charged)',
      createCost: 'Creation cost: ',
      firstFree: 'Free (first influencer)',
      cost10: '10 credits',
      voiceRecommend: 'Recommended voice for your personality:',
      voiceMismatch: 'Voice may not match personality, try:',
      personalityConflict: 'may conflict, consider choosing one',
      domainConflict: 'different audiences, may dilute positioning',
    },
  },
}

// Voice traits mapping (language-independent)
const VOICE_TRAITS = [
  ['冷幽默', '零废话', '严肃', '理性', 'Dry humor', 'No fluff', 'Serious', 'Rational'],
  ['真诚', '治愈', '感性', 'Sincere', 'Healing', 'Emotional'],
  ['阳光', '活泼', '幽默', 'Sunny', 'Lively', 'Humorous'],
  ['霸气', '严肃', '一针见血', 'Powerful', 'Serious', 'Incisive'],
  ['知识型', '严肃', '理性', 'Knowledgeable', 'Serious', 'Rational'],
  ['活泼', '幽默', '阳光', 'Lively', 'Humorous', 'Sunny'],
]

// 根据性格推荐声线 (works with both zh/en traits via VOICE_TRAITS)
function getRecommendedVoiceIndex(personality: string[]): number {
  if (personality.length === 0) return -1
  let bestIndex = 0
  let bestScore = 0
  for (let i = 0; i < VOICE_TRAITS.length; i++) {
    const score = personality.filter(p => VOICE_TRAITS[i].includes(p)).length
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }
  return bestScore > 0 ? bestIndex : -1
}

// 性格冲突对 (zh/en pairs)
const PERSONALITY_CONFLICTS: [string, string, string, string][] = [
  ['严肃', '幽默', 'Serious', 'Humorous'],
  ['严肃', '活泼', 'Serious', 'Lively'],
  ['理性', '感性', 'Rational', 'Emotional'],
  ['冷幽默', '阳光', 'Dry humor', 'Sunny'],
  ['霸气', '萌系', 'Powerful', 'Cute'],
  ['零废话', '活泼', 'No fluff', 'Lively'],
  ['毒舌', '治愈', 'Sarcastic', 'Healing'],
]

// 检测性格标签内部冲突
function checkPersonalityConflict(personality: string[], lang: 'zh' | 'en'): string | null {
  for (const [zhA, zhB, enA, enB] of PERSONALITY_CONFLICTS) {
    const hasA = personality.includes(zhA) || personality.includes(enA)
    const hasB = personality.includes(zhB) || personality.includes(enB)
    if (hasA && hasB) {
      const a = lang === 'en' ? enA : zhA
      const b = lang === 'en' ? enB : zhB
      return lang === 'en'
        ? `"${a}" and "${b}" may conflict, consider choosing one`
        : `「${a}」和「${b}」可能有些矛盾，建议二选一`
    }
  }
  return null
}

// 领域冲突对 (zh/en pairs)
const DOMAIN_CONFLICTS: [string, string, string, string][] = [
  ['财经', '娱乐', 'Finance', 'Entertainment'],
  ['科技', '情感', 'Tech', 'Emotions'],
  ['教育', '游戏', 'Education', 'Gaming'],
]

// 检测领域冲突
function checkDomainConflict(domains: string[], lang: 'zh' | 'en'): string | null {
  for (const [zhA, zhB, enA, enB] of DOMAIN_CONFLICTS) {
    const hasA = domains.includes(zhA) || domains.includes(enA)
    const hasB = domains.includes(zhB) || domains.includes(enB)
    if (hasA && hasB) {
      const a = lang === 'en' ? enA : zhA
      const b = lang === 'en' ? enB : zhB
      return lang === 'en'
        ? `"${a}" and "${b}" have different audiences, may dilute positioning`
        : `「${a}」和「${b}」受众差异较大，可能影响账号定位`
    }
  }
  return null
}

// 检测声线与性格是否匹配
function checkVoiceMismatch(personality: string[], voiceIndex: number, lang: 'zh' | 'en'): string | null {
  if (personality.length === 0 || voiceIndex < 0) return null

  const matched = personality.filter(p => VOICE_TRAITS[voiceIndex]?.includes(p)).length
  if (matched === 0 && personality.length >= 2) {
    const recommendedIdx = getRecommendedVoiceIndex(personality)
    if (recommendedIdx >= 0 && recommendedIdx !== voiceIndex) {
      const voices = i18n[lang].voices
      return lang === 'en'
        ? `Voice may not match personality, try: ${voices[recommendedIdx]?.label}`
        : `当前声线与性格可能不太搭配，推荐：${voices[recommendedIdx]?.label}`
    }
  }
  return null
}

// 根据用户填写信息生成默认图片 prompt
function generateDefaultImagePrompt(type: InfluencerType | '', name: string, personality: string[]): string {
  if (!type) return ''

  const traits = personality.slice(0, 2).join('、')

  switch (type) {
    case 'human':
      return `Professional portrait of ${name || 'a person'}, ${traits ? `personality: ${traits}, ` : ''}half-body shot, natural lighting, high quality, 9:16 aspect ratio`
    case 'animal':
      return `Cute ${name || 'animal'} character, ${traits ? `${traits} vibe, ` : ''}expressive face, studio lighting, centered composition, 9:16`
    case 'virtual':
      return `Anime style character ${name || ''}, ${traits ? `${traits} personality, ` : ''}vibrant colors, detailed illustration, upper body, 9:16`
    case 'brand':
      return `Brand mascot ${name || ''}, ${traits ? `${traits} style, ` : ''}friendly and memorable design, clean background, 9:16`
    default:
      return ''
  }
}

interface Props {
  onSuccess: (inf: Influencer) => void
  onClose: () => void
  isFirst: boolean
  editInfluencer?: Influencer
}

export default function CreateWizard({ onSuccess, onClose, isFirst, editInfluencer }: Props) {
  const lang = useLanguage()
  const t = i18n[lang]
  const L = t.labels
  const isEdit = !!editInfluencer
  const [step, setStep] = useState(isEdit ? 1 : 0)
  const [loading, setLoading] = useState(false)
  const [generatingImg, setGeneratingImg] = useState(false)
  const [generatingTts, setGeneratingTts] = useState(false)
  const [optimizingPrompt, setOptimizingPrompt] = useState(false)
  const [imageUrl, setImageUrl] = useState(editInfluencer?.frontal_image_url || '')
  const [ttsUrl, setTtsUrl] = useState('')
  const [imagePrompt, setImagePrompt] = useState('')
  const [promptOptimized, setPromptOptimized] = useState(false)
  const [imageError, setImageError] = useState('')

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
    voice_prompt: editInfluencer?.voice_prompt ?? i18n.zh.voices[0].value,
  })

  function toggleTag(arr: string[], val: string, max: number): string[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : arr.length < max ? [...arr, val] : arr
  }

  // 进入形象步骤时，自动生成默认 prompt
  useEffect(() => {
    if (step === 2 && !imagePrompt && !imageUrl) {
      const defaultPrompt = generateDefaultImagePrompt(form.type, form.name, form.personality)
      if (defaultPrompt) setImagePrompt(defaultPrompt)
    }
  }, [step, form.type, form.name, form.personality, imagePrompt, imageUrl])

  async function optimizePrompt() {
    if (!imagePrompt) return
    setOptimizingPrompt(true)
    setImageError('')
    try {
      const res = await fetch('/api/influencers/optimize-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          type: form.type,
          name: form.name,
          personality: form.personality,
        }),
      })
      const data = await res.json()
      if (res.ok && data.optimizedPrompt) {
        setImagePrompt(data.optimizedPrompt)
        setPromptOptimized(true)
      } else {
        setImageError(data.error || (lang === 'en' ? 'Optimization failed' : '优化失败，请重试'))
      }
    } catch {
      setImageError(lang === 'en' ? 'Network error' : '网络错误，请重试')
    } finally {
      setOptimizingPrompt(false)
    }
  }

  async function generateImage() {
    if (!imagePrompt) return
    setGeneratingImg(true)
    setImageError('')
    try {
      const res = await fetch('/api/influencers/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt, is_first: isFirst, type: form.type }),
      })
      const data = await res.json()
      if (!res.ok) {
        setImageError(data.error || (lang === 'en' ? 'Generation failed' : '生成失败，请重试'))
        return
      }
      if (data.url) {
        setImageUrl(data.url)
      } else {
        setImageError(lang === 'en' ? 'Failed to generate image' : '未能生成图片，请尝试不同的描述')
      }
    } catch (err) {
      setImageError(lang === 'en' ? 'Network error' : '网络错误，请重试')
      console.error('generateImage error:', err)
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
      <div className="flex items-center justify-between mb-6">
        {t.steps.map((s, i) => (
          <div key={s} className="flex flex-col items-center flex-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors
              ${i < step ? 'bg-violet-600 text-white' :
                i === step ? 'bg-violet-600 text-white ring-2 ring-violet-400/30' :
                'bg-zinc-800 text-zinc-500'}`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`mt-1 text-xs text-center ${i === step ? 'text-white' : 'text-zinc-600'}`}>{s}</span>
          </div>
        ))}
      </div>

      {/* Step 0: Type */}
      {step === 0 && (
        <div className="grid grid-cols-2 gap-3">
          {t.types.map(opt => (
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

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{L.name} *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={L.namePlaceholder} className="bg-zinc-800 border-zinc-700 text-white" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{L.tagline} * <span className="text-zinc-600 font-normal">{L.taglineHint}</span></Label>
            <Input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
              placeholder={L.taglinePlaceholder} className="bg-zinc-800 border-zinc-700 text-white" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{L.personality} * <span className="text-zinc-600 font-normal">{L.personalityHint}</span></Label>
            <div className="flex flex-wrap gap-1.5">
              {t.personality.map(tag => (
                <button key={tag} onClick={() => setForm(f => ({ ...f, personality: toggleTag(f.personality, tag, 3) }))}
                  className={`px-2.5 py-1 rounded-full text-xs transition-colors
                    ${form.personality.includes(tag) ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                  {tag}
                </button>
              ))}
              {/* Custom tags with delete button */}
              {form.personality.filter(tag => !t.personality.includes(tag)).map(tag => (
                <button key={tag} onClick={() => setForm(f => ({ ...f, personality: f.personality.filter(t => t !== tag) }))}
                  className="px-2.5 py-1 rounded-full text-xs bg-violet-600 text-white flex items-center gap-1 group">
                  {tag}
                  <X size={12} className="opacity-60 group-hover:opacity-100" />
                </button>
              ))}
            </div>
            {/* Custom personality tag input */}
            {form.personality.length < 3 && (
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder={L.customTag}
                  className="bg-zinc-800 border-zinc-700 text-white text-xs h-8 flex-1"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim()
                      if (val && !form.personality.includes(val) && form.personality.length < 3) {
                        setForm(f => ({ ...f, personality: [...f.personality, val] }))
                        ;(e.target as HTMLInputElement).value = ''
                      }
                    }
                  }}
                />
                <span className="text-xs text-zinc-600 self-center">{L.pressEnter}</span>
              </div>
            )}
            {/* Personality conflict warning */}
            {(() => {
              const conflict = checkPersonalityConflict(form.personality, lang)
              return conflict ? (
                <div className="p-2 mt-2 rounded-lg bg-amber-900/20 border border-amber-700/50">
                  <p className="text-xs text-amber-300">⚠️ {conflict}</p>
                </div>
              ) : null
            })()}
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{L.domains} * <span className="text-zinc-600 font-normal">{L.domainsHint}</span></Label>
            <div className="flex flex-wrap gap-1.5">
              {t.domains.map(tag => (
                <button key={tag} onClick={() => setForm(f => ({ ...f, domains: toggleTag(f.domains, tag, 3) }))}
                  className={`px-2.5 py-1 rounded-full text-xs transition-colors
                    ${form.domains.includes(tag) ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                  {tag}
                </button>
              ))}
              {/* Custom domains with delete button */}
              {form.domains.filter(tag => !t.domains.includes(tag)).map(tag => (
                <button key={tag} onClick={() => setForm(f => ({ ...f, domains: f.domains.filter(t => t !== tag) }))}
                  className="px-2.5 py-1 rounded-full text-xs bg-violet-600 text-white flex items-center gap-1 group">
                  {tag}
                  <X size={12} className="opacity-60 group-hover:opacity-100" />
                </button>
              ))}
            </div>
            {/* Custom domain input */}
            {form.domains.length < 3 && (
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder={L.customDomain}
                  className="bg-zinc-800 border-zinc-700 text-white text-xs h-8 flex-1"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim()
                      if (val && !form.domains.includes(val) && form.domains.length < 3) {
                        setForm(f => ({ ...f, domains: [...f.domains, val] }))
                        ;(e.target as HTMLInputElement).value = ''
                      }
                    }
                  }}
                />
                <span className="text-xs text-zinc-600 self-center">{L.pressEnter}</span>
              </div>
            )}
            {/* Domain conflict warning */}
            {(() => {
              const conflict = checkDomainConflict(form.domains, lang)
              return conflict ? (
                <div className="p-2 mt-2 rounded-lg bg-amber-900/20 border border-amber-700/50">
                  <p className="text-xs text-amber-300">⚠️ {conflict}</p>
                </div>
              ) : null
            })()}
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{L.catchphrases} <span className="text-zinc-600 font-normal">{L.catchphrasesHint}</span></Label>
            {form.catchphrases.map((cp, i) => (
              <Input key={i} value={cp} onChange={e => setForm(f => {
                const arr = [...f.catchphrases]; arr[i] = e.target.value; return { ...f, catchphrases: arr }
              })} placeholder={`${L.catchphrasePlaceholder} ${i + 1}`} className="bg-zinc-800 border-zinc-700 text-white mb-1.5" />
            ))}
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">{L.speakingStyle} <span className="text-zinc-600 font-normal">{L.optional}</span></Label>
            <Textarea value={form.speaking_style} onChange={e => setForm(f => ({ ...f, speaking_style: e.target.value }))}
              placeholder={L.speakingStylePlaceholder}
              className="bg-zinc-800 border-zinc-700 text-white resize-none" rows={2} />
          </div>
        </div>
      )}

      {/* Step 2: Avatar */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Upload image */}
          <div className="space-y-2">
            <Label className="text-zinc-400">{L.uploadImage}</Label>
            <label className="flex items-center justify-center w-full h-24 rounded-xl border-2 border-dashed border-zinc-700 hover:border-violet-500 cursor-pointer transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const formData = new FormData()
                  formData.append('file', file)
                  formData.append('is_first', String(isFirst))
                  try {
                    const res = await fetch('/api/influencers/upload-image', { method: 'POST', body: formData })
                    const data = await res.json()
                    if (data.url) setImageUrl(data.url)
                  } catch (err) { console.error(err) }
                }}
              />
              <div className="text-center">
                <Upload size={20} className="mx-auto text-zinc-500 mb-1" />
                <span className="text-xs text-zinc-500">{L.clickToUpload}</span>
              </div>
            </label>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-700" />
            <span className="text-xs text-zinc-600">{L.or}</span>
            <div className="flex-1 h-px bg-zinc-700" />
          </div>

          {/* AI Generate */}
          <div className="space-y-2">
            <Label className="text-zinc-400">{L.aiGenerate}</Label>
            <Textarea value={imagePrompt} onChange={e => { setImagePrompt(e.target.value); setPromptOptimized(false) }}
              placeholder={form.type === 'human' ? L.humanPromptPlaceholder : L.otherPromptPlaceholder}
              className="bg-zinc-800 border-zinc-700 text-white resize-none" rows={4} />
            {promptOptimized && (
              <p className="text-xs text-green-400">{L.promptOptimized}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={optimizePrompt} disabled={!imagePrompt || optimizingPrompt || generatingImg}
                variant="outline" className="border-zinc-600 text-zinc-300 hover:text-white">
                {optimizingPrompt ? <><Loader2 size={14} className="animate-spin mr-1.5" />{L.optimizing}</> : L.optimizePrompt}
              </Button>
              <Button onClick={generateImage} disabled={!imagePrompt || generatingImg || optimizingPrompt}
                className="bg-violet-600 hover:bg-violet-700 text-white flex-1">
                {generatingImg ? <><Loader2 size={14} className="animate-spin mr-1.5" />{L.generating}</> : `${L.generateImage}${isFirst ? L.free : L.cost3}`}
              </Button>
            </div>
            {imageError && (
              <p className="text-xs text-red-400">{imageError}</p>
            )}
            {form.type === 'human' && (
              <div className="text-xs text-zinc-500 space-y-1">
                <p>{L.humanImageTips}</p>
                <ul className="list-disc list-inside text-zinc-600">
                  <li>{L.humanImageTip1}</li>
                  <li>{L.humanImageTip2}</li>
                  <li>{L.humanImageTip3}</li>
                  <li>{L.humanImageTip4}</li>
                  <li>{L.humanImageTip5}</li>
                </ul>
              </div>
            )}
          </div>

          {/* Preview */}
          {imageUrl && (
            <div className="relative w-32 h-44 rounded-xl overflow-hidden border border-zinc-700">
              <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
              <button onClick={() => setImageUrl('')}
                className="absolute top-1 right-1 p-1 rounded-full bg-zinc-900/80 text-zinc-400 hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}
          <p className="text-xs text-zinc-600">{L.skipHint}</p>
        </div>
      )}

      {/* Step 3: Voice */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Recommendation */}
          {(() => {
            const recIdx = getRecommendedVoiceIndex(form.personality)
            const recVoice = recIdx >= 0 ? t.voices[recIdx] : null
            return recVoice && form.voice_prompt !== recVoice.value ? (
              <div className="p-3 rounded-lg bg-violet-900/20 border border-violet-700/50">
                <p className="text-xs text-violet-300">
                  💡 {L.voiceRecommend}<span className="font-medium">{recVoice.label}</span>
                </p>
              </div>
            ) : null
          })()}
          <div className="space-y-2">
            <Label className="text-zinc-400">{L.selectVoice}</Label>
            <div className="space-y-2">
              {t.voices.map((opt, idx) => {
                const isRecommended = getRecommendedVoiceIndex(form.personality) === idx
                return (
                  <button key={opt.value} onClick={() => setForm(f => ({ ...f, voice_prompt: opt.value }))}
                    className={`w-full px-4 py-3 rounded-lg border text-left text-sm transition-colors relative
                      ${form.voice_prompt === opt.value ? 'border-violet-500 bg-violet-600/10 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                    {opt.label}
                    {isRecommended && <span className="absolute right-3 text-xs text-violet-400">{L.recommended}</span>}
                  </button>
                )
              })}
              {/* Custom voice option */}
              <button
                onClick={() => setForm(f => ({ ...f, voice_prompt: 'custom' }))}
                className={`w-full px-4 py-3 rounded-lg border text-left text-sm transition-colors
                  ${!t.voices.some(o => o.value === form.voice_prompt) ? 'border-violet-500 bg-violet-600/10 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                {L.customVoice}
              </button>
            </div>
          </div>
          {/* Custom voice input */}
          {!t.voices.some(o => o.value === form.voice_prompt) && (
            <div className="space-y-1.5">
              <Label className="text-zinc-400">{L.voiceDesc} <span className="text-zinc-600 font-normal">{L.voiceDescHint}</span></Label>
              <Textarea
                value={form.voice_prompt === 'custom' ? '' : form.voice_prompt}
                onChange={e => setForm(f => ({ ...f, voice_prompt: e.target.value }))}
                placeholder={L.voiceDescPlaceholder}
                className="bg-zinc-800 border-zinc-700 text-white resize-none text-sm"
                rows={3}
              />
              <p className="text-xs text-zinc-600">{L.voiceDescHelp}</p>
            </div>
          )}
          {/* Voice mismatch warning */}
          {(() => {
            const voiceIdx = t.voices.findIndex(v => v.value === form.voice_prompt)
            const warning = checkVoiceMismatch(form.personality, voiceIdx, lang)
            return warning ? (
              <div className="p-2 rounded-lg bg-amber-900/20 border border-amber-700/50">
                <p className="text-xs text-amber-300">⚠️ {warning}</p>
              </div>
            ) : null
          })()}
          <Button onClick={generateTts} disabled={generatingTts || !form.voice_prompt || form.voice_prompt === 'custom'}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {generatingTts ? <><Loader2 size={14} className="animate-spin mr-1.5" />{L.generating}</> : `${L.previewVoice}${isFirst ? L.free : L.cost2}`}
          </Button>
          {ttsUrl && (
            <audio controls src={ttsUrl} className="w-full mt-2" />
          )}
        </div>
      )}

      {/* Step 4: Save confirmation */}
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
              {form.personality.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
            </div>
          </div>
          <div className="text-sm text-zinc-500">
            {isEdit
              ? <><span className="text-green-400 font-medium">{L.editFree}</span><span>{L.editFreeHint}</span></>
              : <>{L.createCost}<span className="text-white font-medium">{isFirst ? L.firstFree : L.cost10}</span></>
            }
          </div>
        </div>
      )}

      {/* Bottom buttons */}
      <div className="flex justify-between mt-auto pt-6">
        <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep(s => s - 1)}
          className="text-zinc-400 hover:text-white">
          {step === 0 ? L.cancel : <><ChevronLeft size={16} />{L.prev}</>}
        </Button>
        {step < t.steps.length - 1 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {L.next}
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {loading ? <><Loader2 size={14} className="animate-spin mr-1.5" />{isEdit ? L.saving : L.creating}</> : isEdit ? L.save : L.create}
          </Button>
        )}
      </div>
    </div>
  )
}
