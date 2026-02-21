import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateStoryboardFrame } from '@/lib/imagen'
import { apiError } from '@/lib/api-response'
import { createLogger } from '@/lib/logger'

const logger = createLogger('storyboard:preview')

// POST /api/studio/storyboard/preview
// Generate preview images for storyboard clips
// body: { clips: Array<{ index, shot_description, consistency_anchor? }>, styleAnchor, aspectRatio?, jobId? }
// Returns: { previews: Array<{ index, url: string | null }> }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { clips, styleAnchor, aspectRatio, jobId } = await request.json() as {
    clips: Array<{ index: number; shot_description: string; consistency_anchor?: string }>
    styleAnchor: string
    aspectRatio?: string
    jobId?: number
  }

  if (!clips?.length || !styleAnchor) {
    return apiError('Missing clips or styleAnchor', 400)
  }

  // Check if Gemini API key is configured
  if (!process.env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not configured - preview generation disabled')
    return NextResponse.json({
      previews: clips.map(c => ({ index: c.index, url: null })),
      warning: 'Preview generation not available (API key not configured)',
    })
  }

  logger.info('generating previews', { clipCount: clips.length, styleAnchor: styleAnchor.slice(0, 50) })

  // Generate previews in parallel
  const previews = await Promise.all(
    clips.map(async (clip) => {
      try {
        const url = await generateStoryboardFrame({
          shotDescription: clip.shot_description,
          styleAnchor: clip.consistency_anchor || styleAnchor,
          aspectRatio: aspectRatio || '9:16',
          jobId: jobId || 0,
          clipIndex: clip.index,
        })
        logger.info('preview generated', { clipIndex: clip.index, hasUrl: !!url })
        return { index: clip.index, url }
      } catch (err) {
        logger.error('preview generation failed', { clipIndex: clip.index, error: String(err) })
        return { index: clip.index, url: null }
      }
    })
  )

  return NextResponse.json({ previews })
}
