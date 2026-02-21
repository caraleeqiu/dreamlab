import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateStoryboardFrame } from '@/lib/imagen'
import { apiError } from '@/lib/api-response'

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

  // Generate previews in parallel
  const previews = await Promise.all(
    clips.map(async (clip) => {
      const url = await generateStoryboardFrame({
        shotDescription: clip.shot_description,
        styleAnchor: clip.consistency_anchor || styleAnchor,
        aspectRatio: aspectRatio || '9:16',
        jobId: jobId || 0,
        clipIndex: clip.index,
      })
      return { index: clip.index, url }
    })
  )

  return NextResponse.json({ previews })
}
