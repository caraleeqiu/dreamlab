/**
 * Gemini Live API Wrapper
 *
 * Real-time audio/video streaming with Gemini
 * Required for: Real-Time Interaction category
 */

// TODO: npm install @google/genai
// import { GoogleGenAI, Modality } from '@google/genai';

export interface LiveSessionConfig {
  systemInstruction: string;
  responseModalities: ('TEXT' | 'AUDIO')[];
  onTextResponse?: (text: string) => void;
  onAudioResponse?: (audio: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

export interface LiveSession {
  sendAudio: (audioData: ArrayBuffer) => void;
  sendVideo: (frameData: ArrayBuffer) => void;
  sendText: (text: string) => void;
  close: () => void;
}

const TUTOR_SYSTEM_INSTRUCTION = `你是 AI Visual Tutor，一个友好的视觉教育助手。

用户会用摄像头给你看东西，然后问问题。你要：
1. 识别画面中的物体/现象
2. 用通俗易懂的语言解释原理（像一个耐心的老师）
3. 保持对话简洁，每次回复不超过3句话
4. 如果用户说"生成视频"或"做个视频"，输出特殊格式：
   [GENERATE_VIDEO]{"topic": "主题", "style": "cute/professional/fun", "duration": 30}[/GENERATE_VIDEO]

语言：根据用户的语言自动切换中英文。`;

/**
 * Create a Live API session for Visual Tutor
 */
export async function createTutorSession(config: Partial<LiveSessionConfig> = {}): Promise<LiveSession> {
  // TODO: Implement with GenAI SDK Live API
  throw new Error('Not implemented - install @google/genai first');
}

/**
 * Parse generate video command from AI response
 */
export function parseGenerateCommand(text: string): {
  shouldGenerate: boolean;
  params?: { topic: string; style: string; duration: number };
} {
  const match = text.match(/\[GENERATE_VIDEO\](.*?)\[\/GENERATE_VIDEO\]/s);
  if (!match) {
    return { shouldGenerate: false };
  }

  try {
    const params = JSON.parse(match[1]);
    return { shouldGenerate: true, params };
  } catch {
    return { shouldGenerate: false };
  }
}
