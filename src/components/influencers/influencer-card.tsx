'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, Play, Volume2 } from 'lucide-react'
import type { Influencer } from '@/types'

const TYPE_LABEL: Record<string, string> = {
  human: '真人',
  animal: '动物',
  virtual: '虚拟角色',
  brand: '品牌IP',
}

interface Props {
  influencer: Influencer
  onEdit?: (inf: Influencer) => void
  onDelete?: (id: number) => void
}

export default function InfluencerCard({ influencer, onEdit, onDelete }: Props) {
  const [playing, setPlaying] = useState(false)
  const isOwn = !influencer.is_builtin

  async function handlePlay() {
    // 试听 TTS（如果有 frontal_image_url 同级目录有 voice.wav）
    setPlaying(true)
    setTimeout(() => setPlaying(false), 3000)
  }

  return (
    <div className={`relative rounded-xl border bg-zinc-900 overflow-hidden transition-all hover:border-zinc-600
      ${isOwn ? 'border-violet-800/50' : 'border-zinc-800'}`}>

      {/* 标签 */}
      <div className="absolute top-2 left-2 flex gap-1 z-10">
        <Badge variant="secondary" className="text-xs bg-zinc-800/80 text-zinc-400">
          {TYPE_LABEL[influencer.type]}
        </Badge>
        {influencer.is_builtin && (
          <Badge variant="secondary" className="text-xs bg-zinc-800/80 text-zinc-500">官方</Badge>
        )}
        {isOwn && (
          <Badge variant="secondary" className="text-xs bg-violet-900/60 text-violet-300">我的</Badge>
        )}
      </div>

      {/* 操作按钮（仅自建） */}
      {isOwn && (
        <div className="absolute top-2 right-2 flex gap-1 z-10">
          <button
            onClick={() => onEdit?.(influencer)}
            className="p-1.5 rounded-md bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete?.(influencer.id)}
            className="p-1.5 rounded-md bg-zinc-800/80 text-zinc-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* 头像 */}
      <div className="aspect-[3/4] bg-zinc-800 relative">
        {influencer.frontal_image_url ? (
          <Image
            src={influencer.frontal_image_url}
            alt={influencer.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl text-zinc-700">
            {influencer.type === 'animal' ? '🐾' :
             influencer.type === 'virtual' ? '🎭' :
             influencer.type === 'brand' ? '🏷️' : '🧑'}
          </div>
        )}
      </div>

      {/* 信息 */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-sm truncate">{influencer.name}</h3>
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{influencer.tagline}</p>
          </div>
          <button
            onClick={handlePlay}
            className={`shrink-0 p-1.5 rounded-full transition-colors
              ${playing ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
          >
            {playing ? <Volume2 size={13} /> : <Play size={13} />}
          </button>
        </div>

        {/* 性格标签 */}
        <div className="flex flex-wrap gap-1 mt-2">
          {influencer.personality?.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
