'use client';

/**
 * Snap Studio - Creative Storyteller Entry
 *
 * Flow: Take photo / Upload image → Ask question → Generate edu video
 */

import { useState } from 'react';
// import { CameraCapture } from './components/CameraCapture';
// import { ImageUpload } from './components/ImageUpload';
// import { QuestionInput } from './components/QuestionInput';
// import { GenerationProgress } from './components/GenerationProgress';
// import { StyleSelector } from './components/StyleSelector';

type Step = 'capture' | 'question' | 'generating' | 'done';

export default function SnapStudioPage() {
  const [step, setStep] = useState<Step>('capture');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [style, setStyle] = useState<'cute' | 'professional' | 'fun'>('cute');
  const [duration, setDuration] = useState<15 | 30 | 60>(30);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleCapture = (url: string) => {
    setImageUrl(url);
    setStep('question');
  };

  const handleGenerate = async () => {
    if (!imageUrl || !question) return;

    setStep('generating');

    // TODO: Call /api/studio/snap
    // const res = await fetch('/api/studio/snap', {
    //   method: 'POST',
    //   body: JSON.stringify({ imageUrl, question, style, duration }),
    // });
    // const { jobId } = await res.json();
    // setJobId(jobId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">AI Visual Tutor</h1>
          <p className="text-slate-400">拍照提问，秒懂原理</p>
        </div>

        {/* Step: Capture */}
        {step === 'capture' && (
          <div className="space-y-4">
            {/* Camera capture area */}
            <div className="aspect-[4/3] bg-slate-700 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-500">
              <div className="text-center">
                <div className="text-4xl mb-2">📷</div>
                <p className="text-slate-400">点击拍照或上传图片</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button className="py-3 px-4 bg-blue-600 rounded-xl font-medium">
                📸 拍照
              </button>
              <button className="py-3 px-4 bg-slate-600 rounded-xl font-medium">
                📁 上传
              </button>
            </div>
          </div>
        )}

        {/* Step: Question */}
        {step === 'question' && imageUrl && (
          <div className="space-y-4">
            {/* Image preview */}
            <div className="aspect-[4/3] bg-slate-700 rounded-2xl overflow-hidden">
              <img src={imageUrl} alt="captured" className="w-full h-full object-cover" />
            </div>

            {/* Question input */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">你想了解什么？</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="例如：这是什么原理？"
                className="w-full py-3 px-4 bg-slate-700 rounded-xl text-white placeholder:text-slate-500"
              />
            </div>

            {/* Quick options */}
            <div className="flex gap-2 flex-wrap">
              {['这是什么？', '原理是什么？', '怎么工作的？', '为什么会这样？'].map((q) => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className="py-1.5 px-3 bg-slate-700 rounded-full text-sm"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Style & Duration (collapsible) */}
            <details className="bg-slate-700/50 rounded-xl p-4">
              <summary className="cursor-pointer text-slate-400">⚙️ 高级设置</summary>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">风格</label>
                  <div className="flex gap-2">
                    {(['cute', 'professional', 'fun'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStyle(s)}
                        className={`py-2 px-4 rounded-lg ${style === s ? 'bg-blue-600' : 'bg-slate-600'}`}
                      >
                        {s === 'cute' ? '🥰 可爱' : s === 'professional' ? '💼 专业' : '🎉 有趣'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">时长</label>
                  <div className="flex gap-2">
                    {([15, 30, 60] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`py-2 px-4 rounded-lg ${duration === d ? 'bg-blue-600' : 'bg-slate-600'}`}
                      >
                        {d}秒
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </details>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!question}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-bold text-lg disabled:opacity-50"
            >
              🎬 生成知识视频
            </button>
          </div>
        )}

        {/* Step: Generating */}
        {step === 'generating' && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 animate-pulse">🎬</div>
            <h2 className="text-xl font-bold mb-2">正在生成视频...</h2>
            <p className="text-slate-400">AI 正在理解图片并创作教学内容</p>

            {/* Progress steps */}
            <div className="mt-8 space-y-3 text-left max-w-xs mx-auto">
              <div className="flex items-center gap-3">
                <span className="text-green-500">✓</span>
                <span>识别图片内容</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-green-500">✓</span>
                <span>生成教学脚本</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="animate-spin">⏳</span>
                <span className="text-slate-400">生成视频中...</span>
              </div>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-xl font-bold mb-4">视频生成完成！</h2>
            {/* Video player placeholder */}
            <div className="aspect-video bg-slate-700 rounded-2xl mb-4"></div>
            <div className="flex gap-4">
              <button className="flex-1 py-3 bg-blue-600 rounded-xl">⬇️ 下载</button>
              <button className="flex-1 py-3 bg-slate-600 rounded-xl">🔄 再来一个</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
