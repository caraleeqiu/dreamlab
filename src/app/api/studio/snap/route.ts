/**
 * POST /api/studio/snap
 *
 * Creative Storyteller: Image → Educational Video
 *
 * Flow:
 * 1. Receive image URL + question
 * 2. Gemini Vision analyzes image
 * 3. Generate educational script
 * 4. Match suitable influencer
 * 5. Submit to Kling for video generation
 * 6. Return job ID
 */

import { NextRequest, NextResponse } from 'next/server';
// import { createClient } from '@/lib/supabase/server';
// import { analyzeAndGenerateScript } from '@/lib/genai';
// import { deductCredits, createJob, createClipRecords } from '@/lib/job-service';

export const maxDuration = 60;

interface SnapRequest {
  imageUrl: string;
  question: string;
  style?: 'cute' | 'professional' | 'fun';
  duration?: 15 | 30 | 60;
  lang?: 'zh' | 'en';
}

interface SnapResponse {
  jobId: string;
  script: {
    title: string;
    sections: { timestamp: string; dialogue: string }[];
  };
  influencer: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  estimatedTime: number;
}

// Influencer matching rules based on content type
const INFLUENCER_MATCH_RULES: Record<string, string[]> = {
  science: ['senku', 'einstein'], // 科技/科学内容
  nature: ['attenborough', 'miku'], // 自然/动物内容
  art: ['frida', 'miku'], // 艺术/创意内容
  tech: ['senku', 'jarvis'], // 技术/编程内容
  daily: ['miku', 'xiaomei'], // 日常生活内容
  default: ['miku'], // 默认可爱风格
};

export async function POST(req: NextRequest) {
  try {
    const body: SnapRequest = await req.json();
    const { imageUrl, question, style = 'cute', duration = 30, lang = 'zh' } = body;

    // Validate input
    if (!imageUrl || !question) {
      return NextResponse.json(
        { error: lang === 'zh' ? '请提供图片和问题' : 'Image and question required' },
        { status: 400 }
      );
    }

    // TODO: Implement full flow
    // 1. Analyze image with Gemini Vision
    // const { analysis, script, suggestedInfluencerId } = await analyzeAndGenerateScript(
    //   imageUrl,
    //   question,
    //   { style, duration, lang }
    // );

    // 2. Deduct credits
    // await deductCredits(userId, 'snap', lang);

    // 3. Create job and submit to Kling
    // const job = await createJob({ ... });

    // Placeholder response
    return NextResponse.json({
      success: true,
      message: 'Snap API - Not yet implemented',
      received: { imageUrl, question, style, duration },
    });
  } catch (error) {
    console.error('[snap] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
