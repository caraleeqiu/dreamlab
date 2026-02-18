'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Flame, RefreshCw } from 'lucide-react'
import type { Language } from '@/types'

interface Topic {
  id: string; title: string; angle: string
  source: string; date: string; category: string; lang: string
}

export default function TrendingClient({ lang, categories }: { lang: Language; categories: string[] }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(categories[0])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchTopics(activeTab) }, [activeTab])

  async function fetchTopics(category: string) {
    setLoading(true)
    const res = await fetch(`/api/trending?lang=${lang}&category=${encodeURIComponent(category)}`)
    const data = await res.json()
    setTopics(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  function goToPodcast(topic: Topic) {
    const params = new URLSearchParams({ topicId: topic.id, title: topic.title, angle: topic.angle, source: topic.source })
    router.push(`/studio/podcast?${params}`)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Flame size={20} className="text-orange-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">看灵感</h1>
          <p className="text-sm text-zinc-500 mt-0.5">实时热点 · 免费浏览 · 一键进入播客创作</p>
        </div>
      </div>

      {/* 分类 Tab */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveTab(cat)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors
              ${activeTab === cat ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
            {cat}
          </button>
        ))}
        <button onClick={() => fetchTopics(activeTab)} className="p-1.5 rounded-full bg-zinc-800 text-zinc-500 hover:text-white ml-auto">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 话题列表 */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map(topic => (
            <div key={topic.id}
              className="group p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white text-sm leading-snug">{topic.title}</h3>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{topic.angle}</p>
                  <div className="flex gap-3 mt-2">
                    <span className="text-xs text-zinc-600">{topic.source}</span>
                    <span className="text-xs text-zinc-700">{topic.date}</span>
                  </div>
                </div>
                <button onClick={() => goToPodcast(topic)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-violet-600 text-zinc-400 hover:text-white text-xs font-medium transition-all">
                  做播客
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
