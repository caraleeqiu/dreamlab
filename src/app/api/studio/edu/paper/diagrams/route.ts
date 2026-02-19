import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateDiagramsForKeyPoints } from '@/lib/napkin'
import { apiError } from '@/lib/api-response'

// POST /api/studio/edu/paper/diagrams
// Generate Napkin diagrams for all key points in an EduContent.
// Returns diagram image URLs per key point (for storyboard preview).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401)

  const { content } = await req.json()
  if (!content?.keyPoints?.length) {
    return apiError('Missing content.keyPoints', 400)
  }

  const keyPoints: string[] = content.keyPoints
  const context = `${content.title || ''}: ${content.summary || ''}`

  const diagrams = await generateDiagramsForKeyPoints(keyPoints, context)

  return NextResponse.json({ diagrams })
}
