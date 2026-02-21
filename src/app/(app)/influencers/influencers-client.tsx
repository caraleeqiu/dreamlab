'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import InfluencerCard from '@/components/influencers/influencer-card'
import CreateWizard from '@/components/influencers/create-wizard'
import type { Influencer, Language } from '@/types'
import { t, UI } from '@/lib/i18n'
import { localizeInfluencer, getTranslationCacheKey } from '@/lib/influencers-i18n'

interface Props { lang: Language }

// 翻译缓存
const translationCache = new Map<string, Record<string, unknown>>()

export default function InfluencersClient({ lang }: Props) {
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Influencer | null>(null)
  const [translations, setTranslations] = useState<Record<number, Record<string, unknown>>>({})

  // 翻译用户自建网红
  const translateInfluencer = useCallback(async (inf: Influencer) => {
    if (inf.is_builtin || lang !== 'en') return
    const cacheKey = getTranslationCacheKey(inf.id)

    // 检查缓存
    if (translationCache.has(cacheKey)) {
      setTranslations(prev => ({ ...prev, [inf.id]: translationCache.get(cacheKey)! }))
      return
    }

    try {
      const res = await fetch('/api/influencers/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: {
            tagline: inf.tagline,
            personality: inf.personality,
            domains: inf.domains,
            speaking_style: inf.speaking_style,
          },
          targetLang: 'en',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        translationCache.set(cacheKey, data)
        setTranslations(prev => ({ ...prev, [inf.id]: data }))
      }
    } catch (e) {
      console.error('Translation failed:', e)
    }
  }, [lang])

  useEffect(() => {
    fetchInfluencers()
  }, [])

  // 当语言切换到英文时，翻译用户自建网红
  useEffect(() => {
    if (lang === 'en') {
      influencers.filter(i => !i.is_builtin).forEach(translateInfluencer)
    }
  }, [lang, influencers, translateInfluencer])

  async function fetchInfluencers() {
    setLoading(true)
    const res = await fetch('/api/influencers')
    const data = await res.json()
    setInfluencers(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function handleDelete(id: number) {
    if (!confirm(t(lang, UI.influencers.deleteConfirm))) return
    await fetch(`/api/influencers/${id}`, { method: 'DELETE' })
    setInfluencers(inf => inf.filter(i => i.id !== id))
  }

  const myCount = influencers.filter(i => !i.is_builtin).length
  const isFirst = myCount === 0

  // 类型标签映射（用于搜索）
  const TYPE_LABELS: Record<string, string[]> = {
    human: ['真人', 'human'],
    animal: ['动物', 'animal'],
    virtual: ['虚拟角色', 'virtual'],
    brand: ['品牌ip', 'brand'],
  }

  // 对谈风格标签映射
  const CHAT_STYLE_LABELS: Record<string, string[]> = {
    dominant: ['主导型', 'dominant'],
    supportive: ['配合型', 'supportive'],
    balanced: ['平衡型', 'balanced'],
  }

  const filtered = influencers.filter(i => {
    const q = search.toLowerCase()
    // 获取本地化后的数据用于搜索
    const localized = localizeInfluencer(i, lang)
    const dynamicTranslation = translations[i.id] as { tagline?: string; personality?: string[]; domains?: string[]; speaking_style?: string } | undefined

    // 检查类型是否匹配搜索词
    const typeLabels = TYPE_LABELS[i.type] || []
    const matchTypeSearch = typeLabels.some(label => label.toLowerCase().includes(q))

    // 检查对谈风格是否匹配
    const chatStyleLabels = i.chat_style ? (CHAT_STYLE_LABELS[i.chat_style] || []) : []
    const matchChatStyle = chatStyleLabels.some(label => label.toLowerCase().includes(q))

    const matchSearch = !search ||
      // 搜索名字
      i.name.toLowerCase().includes(q) ||
      // 搜索类型标签
      matchTypeSearch ||
      // 搜索对谈风格
      matchChatStyle ||
      // 搜索原始中文内容
      i.tagline?.toLowerCase().includes(q) ||
      i.personality?.some(p => p.toLowerCase().includes(q)) ||
      i.domains?.some(d => d.toLowerCase().includes(q)) ||
      i.speaking_style?.toLowerCase().includes(q) ||
      i.catchphrases?.some(c => c.toLowerCase().includes(q)) ||
      i.forbidden?.toLowerCase().includes(q) ||
      // 搜索本地化后的英文内容（内置网红）
      localized.tagline?.toLowerCase().includes(q) ||
      localized.personality?.some(p => p.toLowerCase().includes(q)) ||
      localized.domains?.some(d => d.toLowerCase().includes(q)) ||
      localized.speaking_style?.toLowerCase().includes(q) ||
      localized.forbidden?.toLowerCase().includes(q) ||
      // 搜索动态翻译内容（用户自建网红）
      dynamicTranslation?.tagline?.toLowerCase().includes(q) ||
      dynamicTranslation?.personality?.some(p => p.toLowerCase().includes(q)) ||
      dynamicTranslation?.domains?.some(d => d.toLowerCase().includes(q)) ||
      dynamicTranslation?.speaking_style?.toLowerCase().includes(q)
    const matchType = typeFilter === 'all' || i.type === typeFilter
    return matchSearch && matchType
  })

  const builtin = filtered.filter(i => i.is_builtin)
  const mine = filtered.filter(i => !i.is_builtin)

  const TYPE_ORDER: Array<{ type: string; label: string; labelEn: string }> = [
    { type: 'human',   label: '真人',   labelEn: 'Human' },
    { type: 'animal',  label: '动物',   labelEn: 'Animal' },
    { type: 'virtual', label: '虚拟角色', labelEn: 'Virtual' },
    { type: 'brand',   label: '品牌IP', labelEn: 'Brand IP' },
  ]

  const builtinByType = TYPE_ORDER
    .map(({ type, label, labelEn }) => ({
      type,
      label: lang === 'zh' ? label : labelEn,
      items: builtin.filter(i => i.type === type),
    }))
    .filter(g => g.items.length > 0)

  const TYPE_TABS_I18N = [
    { value: 'all',     label: lang === 'zh' ? '全部'   : 'All' },
    { value: 'human',   label: lang === 'zh' ? '真人'   : 'Human' },
    { value: 'animal',  label: lang === 'zh' ? '动物'   : 'Animal' },
    { value: 'virtual', label: lang === 'zh' ? '虚拟角色' : 'Virtual' },
    { value: 'brand',   label: lang === 'zh' ? '品牌IP' : 'Brand IP' },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{t(lang, UI.influencers.title)}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{t(lang, UI.influencers.subtitle)}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          {t(lang, UI.influencers.createBtn)} {isFirst ? t(lang, UI.influencers.createFree) : t(lang, UI.influencers.createCost)}
        </button>
      </div>

      {/* 搜索 */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t(lang, UI.influencers.searchPlaceholder)}
          className="pl-9 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
        />
      </div>

      {/* 分类筛选 tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TYPE_TABS_I18N.map(tab => (
          <button
            key={tab.value}
            onClick={() => setTypeFilter(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
              ${typeFilter === tab.value
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* 我的网红 */}
          {mine.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">{t(lang, UI.influencers.mySection)}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {mine.map(inf => {
                  // 应用动态翻译
                  const translated = translations[inf.id]
                  const localizedInf = translated && lang === 'en'
                    ? { ...inf, ...translated }
                    : inf
                  return (
                    <InfluencerCard
                      key={inf.id}
                      influencer={localizedInf}
                      onEdit={setEditTarget}
                      onDelete={handleDelete}
                    />
                  )
                })}
              </div>
            </section>
          )}


          {/* 内置网红（按分类分组） */}
          {builtinByType.map(group => (
            <section key={group.type} className="mb-8">
              <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">
                {group.label}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {group.items.map(inf => (
                  <InfluencerCard key={inf.id} influencer={localizeInfluencer(inf, lang)} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {/* 新建弹窗 */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-lg max-h-[90vh] overflow-y-auto">
          <CreateWizard
            isFirst={isFirst}
            onSuccess={inf => {
              setInfluencers(prev => [inf, ...prev])
              setShowCreate(false)
            }}
            onClose={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      {/* 编辑弹窗 */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null) }}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-lg max-h-[90vh] overflow-y-auto">
          {editTarget && (
            <CreateWizard
              isFirst={false}
              editInfluencer={editTarget}
              onSuccess={updated => {
                setInfluencers(prev => prev.map(i => i.id === updated.id ? updated : i))
                setEditTarget(null)
              }}
              onClose={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
