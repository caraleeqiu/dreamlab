'use client'

import { useEffect, useState } from 'react'

interface EpisodeRow {
  id: number
  title: string | null
  series_name: string | null
  episode_number: number | null
  status: string
  created_at: string
  final_video_url: string | null
}

interface SeriesGroup {
  name: string
  episodes: EpisodeRow[]
  latestStatus: string
}

const STATUS_DOT: Record<string, string> = {
  done:       'bg-green-500',
  generating: 'bg-yellow-400 animate-pulse',
  failed:     'bg-red-500',
  pending:    'bg-zinc-500',
  scripting:  'bg-blue-400 animate-pulse',
  lipsync:    'bg-blue-400 animate-pulse',
  stitching:  'bg-blue-400 animate-pulse',
}

interface Props {
  onContinue: (seriesName: string, nextEpisode: number) => void
}

export default function SeriesPanel({ onContinue }: Props) {
  const [series, setSeries] = useState<SeriesGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/studio/series')
      .then(r => r.json())
      .then(d => { if (d.series) setSeries(d.series) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || series.length === 0) return null

  return (
    <div className="mb-8 space-y-3">
      <h2 className="text-sm font-medium text-zinc-400">系列剧</h2>
      {series.map(s => {
        const sortedEps = [...s.episodes].sort((a, b) => (a.episode_number ?? 0) - (b.episode_number ?? 0))
        const maxEp = Math.max(...sortedEps.map(e => e.episode_number ?? 0), 0)
        return (
          <div key={s.name} className="p-4 rounded-xl border border-zinc-700 bg-zinc-800/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">《{s.name}》</span>
              <button
                onClick={() => onContinue(s.name, maxEp + 1)}
                className="text-xs px-3 py-1 rounded-lg bg-violet-600/20 border border-violet-600/50 text-violet-300 hover:bg-violet-600/30 transition-colors"
              >
                继续创作 第{maxEp + 1}集
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {sortedEps.map(ep => (
                <a
                  key={ep.id}
                  href={`/jobs/${ep.id}`}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-700/50 hover:bg-zinc-700 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${STATUS_DOT[ep.status] ?? 'bg-zinc-500'}`} />
                  <span className="text-xs text-zinc-300">第{ep.episode_number ?? '?'}集</span>
                </a>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
