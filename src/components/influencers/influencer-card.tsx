'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Pencil, Trash2, Play, Volume2, Mic, Zap, CheckCircle2, Loader2 } from 'lucide-react'
import type { Influencer } from '@/types'
import { useLanguage } from '@/context/language-context'

const TYPE_LABEL_ZH: Record<string, string> = {
  human: '真人',
  animal: '动物',
  virtual: '虚拟角色',
  brand: '品牌IP',
}

const TYPE_LABEL_EN: Record<string, string> = {
  human: 'Human',
  animal: 'Animal',
  virtual: 'Virtual',
  brand: 'Brand IP',
}

const CHAT_STYLE_LABEL: Record<string, string> = {
  dominant: '主导型',
  supportive: '配合型',
  balanced: '平衡型',
}

interface Props {
  influencer: Influencer
  onEdit?: (inf: Influencer) => void
  onDelete?: (id: number) => void
}

export default function InfluencerCard({ influencer, onEdit, onDelete }: Props) {
  const [playing, setPlaying] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(!!influencer.kling_element_id)
  const [regError, setRegError] = useState('')
  const lang = useLanguage()
  const isOwn = !influencer.is_builtin
  const TYPE_LABEL = lang === 'en' ? TYPE_LABEL_EN : TYPE_LABEL_ZH

  async function handleRegisterKling(e: React.MouseEvent) {
    e.stopPropagation()
    if (registering || registered) return
    setRegistering(true)
    setRegError('')
    try {
      const res = await fetch(`/api/influencers/${influencer.id}/register-kling`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || (lang === 'en' ? 'Registration failed' : '注册失败'))
      setRegistered(true)
    } catch (err: unknown) {
      setRegError(err instanceof Error ? err.message : (lang === 'en' ? 'Registration failed' : '注册失败'))
    } finally {
      setRegistering(false)
    }
  }

  function handlePlay(e: React.MouseEvent) {
    e.stopPropagation()
    setPlaying(true)
    setTimeout(() => setPlaying(false), 3000)
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation()
    onEdit?.(influencer)
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    onDelete?.(influencer.id)
  }

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className={`relative rounded-xl border bg-zinc-900 overflow-hidden transition-all hover:border-zinc-600 cursor-pointer
          ${isOwn ? 'border-violet-800/50' : 'border-zinc-800'}`}
      >
        {/* 标签 */}
        <div className="absolute top-2 left-2 flex gap-1 z-10">
          <Badge variant="secondary" className="text-xs bg-zinc-800/80 text-zinc-400">
            {TYPE_LABEL[influencer.type]}
          </Badge>
          {influencer.is_builtin && (
            <Badge variant="secondary" className="text-xs bg-zinc-800/80 text-zinc-500">{lang === 'en' ? 'Official' : '官方'}</Badge>
          )}
          {isOwn && (
            <Badge variant="secondary" className="text-xs bg-violet-900/60 text-violet-300">{lang === 'en' ? 'Mine' : '我的'}</Badge>
          )}
        </div>

        {/* 操作按钮（仅自建） */}
        {isOwn && (
          <div className="absolute top-2 right-2 flex gap-1 z-10">
            <button onClick={handleEdit}
              className="p-1.5 rounded-md bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors">
              <Pencil size={13} />
            </button>
            <button onClick={handleDelete}
              className="p-1.5 rounded-md bg-zinc-800/80 text-zinc-400 hover:text-red-400 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        )}

        {/* 头像 */}
        <div className="aspect-[3/4] bg-zinc-800 relative overflow-hidden">
          {influencer.frontal_image_url ? (
            influencer.frontal_image_url.startsWith('data:') ? (
              <img src={influencer.frontal_image_url} alt={influencer.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <Image src={influencer.frontal_image_url} alt={influencer.name} fill className="object-cover" />
            )
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl text-zinc-700">
              {influencer.type === 'animal' ? '🐾' :
               influencer.type === 'virtual' ? '🎭' :
               influencer.type === 'brand' ? '🏷️' : '🧑'}
            </div>
          )}
        </div>

        {/* 基础信息 */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-white text-sm truncate">{influencer.name}</h3>
              <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{influencer.tagline}</p>
            </div>
            <button onClick={handlePlay}
              className={`shrink-0 p-1.5 rounded-full transition-colors
                ${playing ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
              {playing ? <Volume2 size={13} /> : <Play size={13} />}
            </button>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {influencer.personality?.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 详情 Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-800 relative overflow-hidden shrink-0">
                {influencer.frontal_image_url ? (
                  influencer.frontal_image_url.startsWith('data:') ? (
                    <img src={influencer.frontal_image_url} alt={influencer.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <Image src={influencer.frontal_image_url} alt={influencer.name} fill className="object-cover" />
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xl">
                    {influencer.type === 'animal' ? '🐾' : influencer.type === 'virtual' ? '🎭' : influencer.type === 'brand' ? '🏷️' : '🧑'}
                  </div>
                )}
              </div>
              <div>
                <div className="text-white font-semibold">{influencer.name}</div>
                <div className="text-xs text-zinc-500 font-normal mt-0.5">{TYPE_LABEL[influencer.type]} · {influencer.is_builtin ? (lang === 'en' ? 'Official' : '官方内置') : (lang === 'en' ? 'My Influencer' : '我的网红')}</div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* 一句话人设 */}
            <div className="p-3 rounded-lg bg-zinc-800 text-sm text-zinc-300 italic">
              "{influencer.tagline}"
            </div>

            {/* 性格标签 */}
            {influencer.personality?.length > 0 && (
              <div>
                <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">{lang === 'en' ? 'Personality' : '性格标签'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {influencer.personality.map(tag => (
                    <span key={tag} className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-300">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 主领域 */}
            {influencer.domains?.length > 0 && (
              <div>
                <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">{lang === 'en' ? 'Domains' : '主领域'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {influencer.domains.map(d => (
                    <span key={d} className="text-xs px-2 py-1 rounded-full bg-violet-900/40 text-violet-300">{d}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 说话风格 */}
            {influencer.speaking_style && (
              <div>
                <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">{lang === 'en' ? 'Speaking Style' : '说话风格'}</p>
                <p className="text-sm text-zinc-300">{influencer.speaking_style}</p>
              </div>
            )}

            {/* 口头禅 */}
            {(influencer.catchphrases?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">{lang === 'en' ? 'Catchphrases' : '口头禅'}</p>
                <div className="flex flex-wrap gap-2">
                  {influencer.catchphrases!.map(cp => (
                    <span key={cp} className="text-xs px-2.5 py-1 rounded-full border border-zinc-700 text-zinc-400">"{cp}"</span>
                  ))}
                </div>
              </div>
            )}

            {/* 对谈风格 + 禁区 */}
            <div className="grid grid-cols-2 gap-3">
              {influencer.chat_style && (
                <div>
                  <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1">{lang === 'en' ? 'Chat Style' : '对谈风格'}</p>
                  <p className="text-sm text-zinc-300">{CHAT_STYLE_LABEL[influencer.chat_style] ?? influencer.chat_style}</p>
                </div>
              )}
              {influencer.forbidden && (
                <div>
                  <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1">{lang === 'en' ? 'Off-limits' : '禁区'}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{influencer.forbidden}</p>
                </div>
              )}
            </div>

            {/* 声线 */}
            {influencer.voice_prompt && (
              <div>
                <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Mic size={10} /> {lang === 'en' ? 'Voice Profile' : '声线描述'}
                </p>
                <p className="text-xs text-zinc-500 font-mono leading-relaxed">{influencer.voice_prompt}</p>
              </div>
            )}

            {/* Kling Subject Library registration */}
            <div className="pt-2 border-t border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-600 uppercase tracking-wider">
                  {lang === 'en' ? 'Kling Subject Library' : '可灵主体库'}
                </p>
                {registered ? (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle2 size={11} /> {lang === 'en' ? 'Registered' : '已注册'}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRegisterKling}
                    disabled={registering}
                    className="h-6 px-2 text-xs border-violet-700 text-violet-300 hover:bg-violet-900/30"
                  >
                    {registering
                      ? <><Loader2 size={10} className="animate-spin mr-1" />{lang === 'en' ? 'Registering…' : '注册中…'}</>
                      : <><Zap size={10} className="mr-1" />{lang === 'en' ? 'Register' : '注册主体'}</>}
                  </Button>
                )}
              </div>
              {registered && (
                <p className="text-xs text-zinc-600">
                  {lang === 'en'
                    ? 'Character & voice anchored across all video generations'
                    : '角色与声线已锁定，跨批次生成保持一致性'}
                </p>
              )}
              {regError && <p className="text-xs text-red-400">{regError}</p>}
            </div>

            {/* 自建网红操作按钮 */}
            {isOwn && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowDetail(false); onEdit?.(influencer) }}
                  className="flex-1 border-zinc-700 text-zinc-300 hover:text-white">
                  <Pencil size={13} className="mr-1.5" /> {lang === 'en' ? 'Edit' : '编辑'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setShowDetail(false); onDelete?.(influencer.id) }}
                  className="border-zinc-700 text-red-400 hover:text-red-300 hover:border-red-800">
                  <Trash2 size={13} />
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
