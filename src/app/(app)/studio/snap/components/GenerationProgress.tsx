'use client';

/**
 * GenerationProgress Component
 *
 * Shows the interleaved generation process:
 * 1. Image analysis
 * 2. Script generation
 * 3. Influencer matching
 * 4. Video generation
 *
 * Required for: Creative Storyteller category (interleaved output)
 */

import { useState, useEffect } from 'react';

export type GenerationStep =
  | 'analyzing'
  | 'scripting'
  | 'matching'
  | 'generating'
  | 'stitching'
  | 'done'
  | 'error';

interface StepInfo {
  id: GenerationStep;
  label: string;
  labelEn: string;
  icon: string;
}

const STEPS: StepInfo[] = [
  { id: 'analyzing', label: '识别图片内容', labelEn: 'Analyzing image', icon: '🔍' },
  { id: 'scripting', label: '生成教学脚本', labelEn: 'Writing script', icon: '✍️' },
  { id: 'matching', label: '匹配最佳网红', labelEn: 'Matching influencer', icon: '🎭' },
  { id: 'generating', label: '生成视频片段', labelEn: 'Generating clips', icon: '🎬' },
  { id: 'stitching', label: '合成最终视频', labelEn: 'Stitching video', icon: '🎞️' },
];

interface GenerationProgressProps {
  currentStep: GenerationStep;
  lang?: 'zh' | 'en';
  // Intermediate results for interleaved display
  analysisResult?: {
    topic: string;
    keyPoints: string[];
  };
  scriptPreview?: {
    title: string;
    hook: string;
  };
  matchedInfluencer?: {
    name: string;
    avatarUrl: string;
  };
  error?: string;
}

export function GenerationProgress({
  currentStep,
  lang = 'zh',
  analysisResult,
  scriptPreview,
  matchedInfluencer,
  error,
}: GenerationProgressProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="space-y-4">
      {/* Progress steps */}
      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = step.id === currentStep;
          const isPending = index > currentIndex;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                isCurrent ? 'bg-blue-500/20' : isComplete ? 'bg-green-500/10' : 'bg-slate-800/50'
              }`}
            >
              {/* Status icon */}
              <div className="w-8 h-8 flex items-center justify-center">
                {isComplete ? (
                  <span className="text-green-500 text-xl">✓</span>
                ) : isCurrent ? (
                  <span className="text-xl animate-pulse">{step.icon}</span>
                ) : (
                  <span className="text-slate-600 text-xl">{step.icon}</span>
                )}
              </div>

              {/* Label */}
              <span
                className={`flex-1 ${
                  isPending ? 'text-slate-500' : isComplete ? 'text-slate-300' : 'text-white'
                }`}
              >
                {lang === 'zh' ? step.label : step.labelEn}
              </span>

              {/* Current indicator */}
              {isCurrent && (
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
            </div>
          );
        })}
      </div>

      {/* Intermediate results (interleaved output) */}
      <div className="space-y-3 mt-6">
        {/* Analysis result */}
        {analysisResult && (
          <div className="p-4 bg-slate-800 rounded-xl">
            <h4 className="text-sm text-slate-400 mb-2">
              {lang === 'zh' ? '🔍 识别结果' : '🔍 Analysis'}
            </h4>
            <p className="font-medium">{analysisResult.topic}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {analysisResult.keyPoints.map((point, i) => (
                <span key={i} className="px-2 py-1 bg-slate-700 rounded text-xs">
                  {point}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Script preview */}
        {scriptPreview && (
          <div className="p-4 bg-slate-800 rounded-xl">
            <h4 className="text-sm text-slate-400 mb-2">
              {lang === 'zh' ? '✍️ 脚本预览' : '✍️ Script Preview'}
            </h4>
            <p className="font-medium">{scriptPreview.title}</p>
            <p className="text-slate-400 text-sm mt-1">"{scriptPreview.hook}"</p>
          </div>
        )}

        {/* Matched influencer */}
        {matchedInfluencer && (
          <div className="p-4 bg-slate-800 rounded-xl flex items-center gap-3">
            <img
              src={matchedInfluencer.avatarUrl}
              alt={matchedInfluencer.name}
              className="w-12 h-12 rounded-full"
            />
            <div>
              <h4 className="text-sm text-slate-400">
                {lang === 'zh' ? '🎭 讲解员' : '🎭 Presenter'}
              </h4>
              <p className="font-medium">{matchedInfluencer.name}</p>
            </div>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl">
          <p className="text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
