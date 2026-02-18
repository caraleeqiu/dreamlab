'use client'

import { useState, useEffect } from 'react'
import { Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import InfluencerCard from '@/components/influencers/influencer-card'
import CreateWizard from '@/components/influencers/create-wizard'
import type { Influencer } from '@/types'

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Influencer | null>(null)

  useEffect(() => {
    fetchInfluencers()
  }, [])

  async function fetchInfluencers() {
    setLoading(true)
    const res = await fetch('/api/influencers')
    const data = await res.json()
    setInfluencers(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('确定删除该网红？积分不退还。')) return
    await fetch(`/api/influencers/${id}`, { method: 'DELETE' })
    setInfluencers(inf => inf.filter(i => i.id !== id))
  }

  const myCount = influencers.filter(i => !i.is_builtin).length
  const isFirst = myCount === 0

  const filtered = influencers.filter(i =>
    !search ||
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.tagline?.toLowerCase().includes(search.toLowerCase())
  )

  const builtin = filtered.filter(i => i.is_builtin)
  const mine = filtered.filter(i => !i.is_builtin)

  return (
    <div className="max-w-6xl mx-auto">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">网红管理</h1>
          <p className="text-sm text-zinc-500 mt-0.5">选择或创建你的 AI 虚拟网红</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          新建网红 {isFirst ? '（免费）' : '（10积分）'}
        </button>
      </div>

      {/* 搜索 */}
      <div className="relative mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索网红..."
          className="pl-9 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* 我的网红 */}
          {mine.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-medium text-zinc-400 mb-3">我的网红</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {mine.map(inf => (
                  <InfluencerCard
                    key={inf.id}
                    influencer={inf}
                    onEdit={setEditTarget}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 新建入口（我的网红为空时显示在顶部） */}
          {mine.length === 0 && !search && (
            <section className="mb-8">
              <h2 className="text-sm font-medium text-zinc-400 mb-3">我的网红</h2>
              <button
                onClick={() => setShowCreate(true)}
                className="w-40 aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-700 hover:border-violet-500 flex flex-col items-center justify-center gap-2 text-zinc-600 hover:text-violet-400 transition-colors"
              >
                <Plus size={24} />
                <span className="text-xs">新建网红</span>
                <span className="text-xs text-zinc-700">首个免费</span>
              </button>
            </section>
          )}

          {/* 内置网红 */}
          {builtin.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-zinc-400 mb-3">官方内置网红 · 免费使用（带水印）</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {builtin.map(inf => (
                  <InfluencerCard key={inf.id} influencer={inf} />
                ))}
              </div>
            </section>
          )}
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
