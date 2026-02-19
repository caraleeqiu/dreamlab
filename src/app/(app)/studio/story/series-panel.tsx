'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/context/language-context'

interface EpisodeRow {
  id: number
  title: string | null
  series_name: string | null
  episode_number: number | null
  cliffhanger: string | null
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
  const lang = useLanguage()
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
      <h2 className="text-sm font-medium text-zinc-400">{lang === 'zh' ? '系列剧' : 'Series'}</h2>
      {series.map(s => {
        const sortedEps = [...s.episodes].sort((a, b) => (a.episode_number ?? 0) - (b.episode_number ?? 0))
        const maxEp = Math.max(...sortedEps.map(e => e.episode_number ?? 0), 0)
        const lastEp = sortedEps[sortedEps.length - 1]
        return (
          <div key={s.name} className="p-4 rounded-xl border border-zinc-700 bg-zinc-800/50 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-sm font-medium text-white">《{s.name}》</span>
                <span className="ml-2 text-xs text-zinc-500">
                  {sortedEps.length}{lang === 'zh' ? ' 集' : ' eps'}
                </span>
                {/* Last episode cliffhanger */}
                {lastEp?.cliffhanger && (
                  <p className="text-xs text-zinc-500 italic mt-1 truncate">
                    {lang === 'zh' ? '悬念：' : 'Cliffhanger: '}
                    <span className="text-violet-400/80">{lastEp.cliffhanger}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => onContinue(s.name, maxEp + 1)}
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-600/50 text-violet-300 hover:bg-violet-600/30 transition-colors"
              >
                {lang === 'zh' ? `继续 第${maxEp + 1}集` : `Ep ${maxEp + 1} →`}
              </button>
            </div>
            {/* Episode pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {sortedEps.map(ep => (
                <a
                  key={ep.id}
                  href={`/jobs/${ep.id}`}
                  title={ep.title ?? ''}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-700/50 hover:bg-zinc-700 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${STATUS_DOT[ep.status] ?? 'bg-zinc-500'}`} />
                  <span className="text-xs text-zinc-300">
                    {lang === 'zh' ? `第${ep.episode_number ?? '?'}集` : `Ep ${ep.episode_number ?? '?'}`}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
