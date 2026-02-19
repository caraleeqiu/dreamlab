'use client'

import { Player } from '@remotion/player'
import { AbsoluteFill, Video, useCurrentFrame } from 'remotion'
import { useState, useMemo } from 'react'
import type { ScriptClip } from '@/types'

const FPS = 30
const SUBTITLE_FADE_FRAMES = 3

interface SubtitleEntry {
  dialogue: string
  startFrame: number
  endFrame: number
}

// ─── Remotion composition ─────────────────────────────────────────────────────

function SubtitleLayer({ entries }: { entries: SubtitleEntry[] }) {
  const frame = useCurrentFrame()
  const active = entries.find(e => frame >= e.startFrame && frame < e.endFrame)
  if (!active?.dialogue) return null

  // Fade in / fade out
  const fadeIn = Math.min(1, (frame - active.startFrame) / SUBTITLE_FADE_FRAMES)
  const fadeOut = Math.min(1, (active.endFrame - frame) / SUBTITLE_FADE_FRAMES)
  const opacity = Math.min(fadeIn, fadeOut)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '7%',
        left: '4%',
        right: '4%',
        textAlign: 'center',
        opacity,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          color: '#fff',
          fontSize: 32,
          fontFamily: '"PingFang SC","Noto Sans SC","Heiti SC",sans-serif',
          lineHeight: 1.5,
          textShadow: '0 2px 6px rgba(0,0,0,1), 0 0 12px rgba(0,0,0,0.9)',
          background: 'rgba(0,0,0,0.45)',
          borderRadius: 10,
          padding: '6px 18px',
          maxWidth: '92%',
          wordBreak: 'break-word',
        }}
      >
        {active.dialogue}
      </span>
    </div>
  )
}

interface CompositionProps {
  videoSrc: string
  entries: SubtitleEntry[]
}

function VideoComposition({ videoSrc, entries }: CompositionProps) {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Video src={videoSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <SubtitleLayer entries={entries} />
    </AbsoluteFill>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

interface Props {
  videoSrc: string
  script: ScriptClip[]
  aspectRatio?: string   // "9:16" | "16:9" | "1:1"
  className?: string
}

export default function VideoPlayerWithSubtitles({ videoSrc, script, aspectRatio = '9:16', className }: Props) {
  const [showSubs, setShowSubs] = useState(true)

  // Build frame-accurate subtitle entries from script durations
  const { entries, totalFrames, width, height } = useMemo(() => {
    let cursor = 0
    const entries: SubtitleEntry[] = script.map(clip => {
      const durationFrames = Math.round((clip.duration || 15) * FPS)
      const entry: SubtitleEntry = {
        dialogue: clip.dialogue || '',
        startFrame: cursor,
        endFrame: cursor + durationFrames,
      }
      cursor += durationFrames
      return entry
    })

    const [wRatio, hRatio] = aspectRatio.split(':').map(Number)
    const base = 1080
    const w = wRatio >= hRatio ? base : Math.round(base * wRatio / hRatio)
    const h = hRatio >= wRatio ? base : Math.round(base * hRatio / wRatio)
    const scaledW = wRatio <= hRatio ? Math.round(base * wRatio / hRatio) : base
    const scaledH = wRatio <= hRatio ? base : Math.round(base * hRatio / wRatio)

    // Standard: 9:16 → 1080×1920, 16:9 → 1920×1080, 1:1 → 1080×1080
    const compositionW = aspectRatio === '16:9' ? 1920 : aspectRatio === '1:1' ? 1080 : 1080
    const compositionH = aspectRatio === '16:9' ? 1080 : aspectRatio === '1:1' ? 1080 : 1920

    return {
      entries,
      totalFrames: Math.max(cursor, FPS * 3),
      width: compositionW,
      height: compositionH,
    }
  }, [script, aspectRatio])

  return (
    <div className={className}>
      <Player
        component={VideoComposition}
        durationInFrames={totalFrames}
        fps={FPS}
        compositionWidth={width}
        compositionHeight={height}
        style={{ width: '100%', borderRadius: 12 }}
        inputProps={{ videoSrc, entries: showSubs ? entries : [] }}
        controls
        loop={false}
        showVolumeControls
        clickToPlay
      />
      {/* Subtitle toggle */}
      <div className="flex justify-center mt-2">
        <button
          onClick={() => setShowSubs(v => !v)}
          className="text-xs px-3 py-1 rounded-full border border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-400 transition-colors"
        >
          {showSubs ? '字幕 ON' : '字幕 OFF'}
        </button>
      </div>
    </div>
  )
}
