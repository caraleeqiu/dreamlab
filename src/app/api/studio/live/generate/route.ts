/**
 * POST /api/studio/live/generate
 *
 * Generate video from Live conversation context
 *
 * Called when user says "generate video" during Live session.
 * Receives extracted parameters from conversation.
 */

import { NextRequest, NextResponse } from 'next/server';

interface LiveGenerateRequest {
  topic: string;
  style: 'cute' | 'professional' | 'fun';
  duration: 15 | 30 | 60;
  conversationContext?: string; // Summary of the conversation
  capturedFrameUrl?: string; // Screenshot from camera
  lang?: 'zh' | 'en';
}

export async function POST(req: NextRequest) {
  try {
    const body: LiveGenerateRequest = await req.json();
    const { topic, style, duration, conversationContext, capturedFrameUrl, lang = 'zh' } = body;

    if (!topic) {
      return NextResponse.json(
        { error: lang === 'zh' ? '请提供主题' : 'Topic required' },
        { status: 400 }
      );
    }

    // TODO: Implement
    // 1. Generate script based on topic and conversation context
    // 2. Match influencer
    // 3. Create job and submit to Kling

    return NextResponse.json({
      success: true,
      message: 'Live generate API - Not yet implemented',
      received: { topic, style, duration },
    });
  } catch (error) {
    console.error('[live/generate] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
