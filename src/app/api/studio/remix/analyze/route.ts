import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGeminiVision } from '@/lib/gemini'
import { apiError } from '@/lib/api-response'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import type { RemixAnalysis, ScriptClip } from '@/types'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

export const maxDuration = 120
export const runtime = 'nodejs'

// Extract N evenly-spaced keyframes from a video file.
// Returns JPEG buffers.
async function extractKeyframes(videoPath: string, count = 6): Promise<Buffer[]> {
  const dur = await getVideoDuration(videoPath)
  if (!dur) return []

  const frames: Buffer[] = []
  const interval = dur / (count + 1)

  for (let i = 1; i <= count; i++) {
    const ts = (interval * i).toFixed(2)
    const outPath = videoPath.replace('.mp4', `_frame${i}.jpg`)
    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .inputOptions(['-ss', ts])
          .outputOptions(['-vframes', '1', '-q:v', '3'])
          .output(outPath)
          .on('end', () => resolve())
          .on('error', reject)
          .run()
      })
      if (fs.existsSync(outPath)) {
        frames.push(fs.readFileSync(outPath))
        try { fs.unlinkSync(outPath) } catch {}
      }
    } catch { /* skip failed frame */ }
  }
  return frames
}

function getVideoDuration(videoPath: string): Promise<number | null> {
  return new Promise(resolve => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) resolve(null)
      else resolve((meta.format.duration as number | undefined) ?? null)
    })
  })
}

// POST /api/studio/remix/analyze
// Body: { videoUrl, influencerSlug?, lang? }
// Returns: RemixAnalysis (narrative breakdown + auto-generated remixScript)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { videoUrl, lang = 'zh' } = await req.json()
  if (!videoUrl) return apiError('Missing videoUrl', 400)

  const tmpDir = path.join(os.tmpdir(), `remix_analyze_${Date.now()}`)
  try {
    fs.mkdirSync(tmpDir, { recursive: true })
    const videoPath = path.join(tmpDir, 'ref.mp4')

    // Download reference video
    const res = await fetch(videoUrl, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return apiError(`Cannot fetch video: ${res.status}`, 400)
    fs.writeFileSync(videoPath, Buffer.from(await res.arrayBuffer()))

    // Extract keyframes for Gemini Vision
    const frames = await extractKeyframes(videoPath, 6)
    if (!frames.length) return apiError('Could not extract frames from video', 422)

    const isZh = lang !== 'en'

    const textPrompt = `You are a viral short-video analyst. Analyze the ${frames.length} keyframes extracted from a short-form video (one frame per ~equal interval).

Provide a COMPLETE narrative decomposition. Output strict JSON:
{
  "narrative": {
    "hookType": "one of: bold_claim|question|story|stat|contrast|visual|action",
    "structure": "one of: hook-build-payoff|reveal|loop|contrast|problem-solution",
    "pacing": "one of: ultra-fast|fast|medium|slow",
    "platformStyle": "one of: tiktok|xiaohongshu|bilibili|youtube|instagram|douyin",
    "totalScenes": <integer matching number of frames analyzed>,
    "estimatedTotalDuration": <estimated total seconds, e.g. 30>
  },
  "scenes": [
    {
      "sceneIndex": 0,
      "estimatedDuration": <seconds for this scene, e.g. 5>,
      "subject": "<character description: what they wear, expression, gesture, body language — NO name>",
      "location": "<environment: indoor/outdoor, props, colors, background details>",
      "lighting": "<lighting setup: key light direction, color temperature, shadows>",
      "cameraShot": "<shot type e.g. 'medium close-up, slow dolly in'>",
      "emotion": "<primary emotion conveyed: urgency/curiosity/excitement/calm/etc>",
      "dialogueStyle": "<speaking energy: fast/slow, whispering/bold, authoritative/casual>",
      "storyboardPrompt": "<Kling-ready English prompt for the ENVIRONMENT ONLY — describe background, lighting, atmosphere, props — NO character description>",
      "consistencyAnchor": "<location+lighting lock string — ALL scenes in same location MUST share identical anchor. Format: 'location, lighting, time of day'>",
      "bgm": "one of: 轻松欢快|科技感|励志|悬疑|温馨|紧张"
    }
    // ... one entry per keyframe
  ],
  "styleGuide": {
    "visualStyle": "<e.g. 'cinematic warm tones, shallow depth of field'>",
    "colorPalette": "<e.g. 'warm amber + deep shadows'>",
    "lightingSetup": "<e.g. '3-point studio, key from camera-left 45°'>",
    "editingRhythm": "<e.g. 'fast cuts every 2-3s, hard transitions'>"
  },
  "remixScript": [
    {
      "index": 0,
      "speaker": "{{INFLUENCER_SLUG}}",
      "dialogue": "${isZh ? '<15秒内自然说完的中文台词，学习原视频的语气和节奏>' : '<natural dialogue matching original pacing and energy>'}",
      "shot_description": "<combine storyboardPrompt + camera from scene + micro-movements: natural hand gestures, realistic breathing, subtle body language>",
      "shot_type": "<景别>",
      "camera_movement": "<运镜>",
      "bgm": "<bgm from scene>",
      "voiceover": "",
      "consistency_anchor": "<character_description placeholder + consistencyAnchor from scene>",
      "scene_anchor": "<scene storyboardPrompt compressed to one anchor string>",
      "duration": <estimatedDuration from scene>
    }
    // ... one per scene
  ]
}`

    const analysis = await callGeminiVision<RemixAnalysis>({
      textPrompt,
      imageBuffers: frames,
    })

    // Clean up
    return NextResponse.json(analysis)
  } catch (err) {
    return apiError(`Analysis failed: ${(err as Error).message}`, 500)
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}
