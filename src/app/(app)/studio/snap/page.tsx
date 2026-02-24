'use client';

/**
 * Snap Studio - AI Visual Tutor
 *
 * Creative Storyteller Entry for Gemini Challenge
 * Flow: Take photo / Upload image → Ask question → Generate edu video
 */

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'capture' | 'question' | 'generating' | 'done';

interface AnalysisResult {
  topic: string;
  category: string;
  keyPoints: string[];
}

interface GenerationResult {
  jobId: number;
  title: string;
  analysis: AnalysisResult;
  influencer: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  script: Array<{ duration: number; dialogue: string }>;
}

export default function SnapStudioPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('capture');
  const [imageData, setImageData] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [style, setStyle] = useState<'cute' | 'professional' | 'fun'>('cute');
  const [duration, setDuration] = useState<15 | 30 | 60>(30);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationStep, setGenerationStep] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      setError('无法访问摄像头');
    }
  };

  // Stop camera
  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach((track) => track.stop());
    setIsCameraActive(false);
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setImageData(dataUrl);
    stopCamera();
    setStep('question');
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageData(ev.target?.result as string);
      setStep('question');
    };
    reader.readAsDataURL(file);
  };

  // Generate video
  const handleGenerate = async () => {
    if (!imageData || !question) return;

    setIsLoading(true);
    setError(null);
    setStep('generating');
    setGenerationStep(0);

    try {
      // Simulate progress steps
      const progressInterval = setInterval(() => {
        setGenerationStep((prev) => Math.min(prev + 1, 4));
      }, 2000);

      const res = await fetch('/api/studio/snap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          question,
          style,
          duration,
          lang: 'zh',
        }),
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '生成失败');
      }

      const data: GenerationResult = await res.json();
      setResult(data);
      setGenerationStep(5);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试');
      setStep('question');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to start
  const handleReset = () => {
    setStep('capture');
    setImageData(null);
    setQuestion('');
    setResult(null);
    setError(null);
    setGenerationStep(0);
  };

  const generationSteps = [
    { label: '分析图片内容', icon: '🔍' },
    { label: '理解问题', icon: '💡' },
    { label: '生成教学脚本', icon: '✍️' },
    { label: '匹配最佳讲解员', icon: '🎭' },
    { label: '生成视频', icon: '🎬' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Hidden elements */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="max-w-lg mx-auto p-4 pb-20">
        {/* Header */}
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold mb-1">AI Visual Tutor</h1>
          <p className="text-slate-400 text-sm">拍照提问，秒懂原理</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Step: Capture */}
        {step === 'capture' && (
          <div className="space-y-4">
            {/* Camera / Preview area */}
            <div className="aspect-[4/3] bg-slate-800 rounded-2xl overflow-hidden relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!isCameraActive && 'hidden'}`}
              />
              {!isCameraActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-5xl mb-3">📷</div>
                    <p className="text-slate-400">拍照或上传图片</p>
                    <p className="text-slate-500 text-sm mt-1">对准你想了解的东西</p>
                  </div>
                </div>
              )}

              {/* Capture button overlay */}
              {isCameraActive && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <button
                    onClick={capturePhoto}
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-4 border-slate-300 shadow-lg"
                  >
                    <div className="w-12 h-12 bg-white rounded-full border-2 border-slate-200" />
                  </button>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {!isCameraActive && (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={startCamera}
                  className="py-4 px-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <span className="text-xl">📸</span> 拍照
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-4 px-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <span className="text-xl">📁</span> 上传
                </button>
              </div>
            )}

            {isCameraActive && (
              <button
                onClick={stopCamera}
                className="w-full py-3 bg-slate-700 rounded-xl text-slate-300"
              >
                取消
              </button>
            )}
          </div>
        )}

        {/* Step: Question */}
        {step === 'question' && imageData && (
          <div className="space-y-4">
            {/* Image preview */}
            <div className="aspect-[4/3] bg-slate-800 rounded-2xl overflow-hidden relative">
              <img src={imageData} alt="captured" className="w-full h-full object-cover" />
              <button
                onClick={handleReset}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Question input */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">你想了解什么？</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="例如：这是什么？它的原理是什么？"
                className="w-full py-3 px-4 bg-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* Quick questions */}
            <div className="flex gap-2 flex-wrap">
              {['这是什么？', '原理是什么？', '怎么工作的？', '为什么会这样？'].map((q) => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className={`py-1.5 px-3 rounded-full text-sm transition-colors ${
                    question === q ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Advanced settings */}
            <details className="bg-slate-800/50 rounded-xl">
              <summary className="p-4 cursor-pointer text-slate-400 text-sm">⚙️ 高级设置</summary>
              <div className="px-4 pb-4 space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-2">风格</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'cute', label: '🥰 可爱' },
                      { value: 'professional', label: '💼 专业' },
                      { value: 'fun', label: '🎉 有趣' },
                    ] as const).map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setStyle(s.value)}
                        className={`flex-1 py-2 rounded-lg text-sm ${
                          style === s.value ? 'bg-blue-600' : 'bg-slate-700'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-2">时长</label>
                  <div className="flex gap-2">
                    {([15, 30, 60] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`flex-1 py-2 rounded-lg text-sm ${
                          duration === d ? 'bg-blue-600' : 'bg-slate-700'
                        }`}
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
              disabled={!question || isLoading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              🎬 生成知识视频
            </button>
          </div>
        )}

        {/* Step: Generating */}
        {step === 'generating' && (
          <div className="py-8">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4 animate-bounce">🎬</div>
              <h2 className="text-xl font-bold mb-2">正在生成视频...</h2>
              <p className="text-slate-400 text-sm">AI 正在理解图片并创作教学内容</p>
            </div>

            {/* Progress steps */}
            <div className="space-y-3 max-w-xs mx-auto">
              {generationSteps.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    i < generationStep
                      ? 'bg-green-500/20'
                      : i === generationStep
                        ? 'bg-blue-500/20'
                        : 'bg-slate-800/50'
                  }`}
                >
                  <span className={i <= generationStep ? '' : 'opacity-30'}>
                    {i < generationStep ? '✓' : s.icon}
                  </span>
                  <span className={i <= generationStep ? 'text-white' : 'text-slate-500'}>
                    {s.label}
                  </span>
                  {i === generationStep && (
                    <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  )}
                </div>
              ))}
            </div>

            {/* Analysis preview (interleaved output) */}
            {result?.analysis && (
              <div className="mt-6 p-4 bg-slate-800 rounded-xl">
                <h4 className="text-sm text-slate-400 mb-2">🔍 识别结果</h4>
                <p className="font-medium">{result.analysis.topic}</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {result.analysis.keyPoints.slice(0, 3).map((point, i) => (
                    <span key={i} className="px-2 py-1 bg-slate-700 rounded text-xs">
                      {point}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-xl font-bold">{result.title}</h2>
            </div>

            {/* Analysis summary */}
            <div className="p-4 bg-slate-800 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={result.influencer.avatarUrl || '/default-avatar.png'}
                  alt={result.influencer.name}
                  className="w-10 h-10 rounded-full bg-slate-700"
                />
                <div>
                  <p className="font-medium">{result.influencer.name}</p>
                  <p className="text-xs text-slate-400">正在为你讲解</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {result.analysis.keyPoints.map((point, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-700 rounded text-xs">
                    {point}
                  </span>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-xl text-center">
              <p className="text-blue-300">视频正在生成中，预计需要 1-2 分钟</p>
              <p className="text-sm text-blue-400 mt-1">生成完成后会在「任务」页面显示</p>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/jobs')}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors"
              >
                查看任务
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
              >
                再来一个
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
